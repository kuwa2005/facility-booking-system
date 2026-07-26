// CGI adapter for Express app - runs each request as a separate Node.js process
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

// IMPORTANT: Redirect all console output to stderr before loading the app
// This prevents Express/app console.log from corrupting CGI headers
const origConsoleLog = console.log;
const origConsoleError = console.error;
const origConsoleWarn = console.warn;
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write('[ERROR] ' + args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write('[WARN] ' + args.join(' ') + '\n');

// Read request body from stdin
function readBody() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const maxSize = 10 * 1024 * 1024;

    process.stdin.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);

    if (process.stdin.isTTY) {
      resolve(Buffer.alloc(0));
    }
  });
}

// Parse cookie header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const [name, ...rest] = pair.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}

// CGI output helper
function cgiOutput(statusCode, headers, body) {
  let output = 'Status: ' + statusCode + '\r\n';
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      // Handle multiple values (e.g., Set-Cookie)
      for (const v of value) {
        output += name.charAt(0).toUpperCase() + name.slice(1) + ': ' + v + '\r\n';
      }
    } else {
      output += name.charAt(0).toUpperCase() + name.slice(1) + ': ' + value + '\r\n';
    }
  }
  output += '\r\n';
  process.stdout.write(output);
  process.stdout.write(body, () => process.exit(0));
}

async function main() {
  const env = process.env;
  const body = await readBody();

  const method = env.REQUEST_METHOD || 'GET';
  const host = env.HTTP_HOST || env.SERVER_NAME || 'localhost';
  const protocol = env.HTTPS === 'on' ? 'https' : 'http';
  const pathInfo = env.PATH_INFO || '/';
  const queryString = env.QUERY_STRING || '';

  // Construct URL path
  let urlPath = pathInfo;
  if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
  const fullUrl = `${protocol}://${host}${urlPath}${queryString ? '?' + queryString : ''}`;

  // Parse URL
  let parsedUrl;
  try {
    parsedUrl = new URL(fullUrl);
  } catch (e) {
    parsedUrl = new URL(`${protocol}://${host}/`);
  }

  // Build headers
  const headers = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('HTTP_')) {
      const headerName = key.slice(5).replace(/_/g, '-').toLowerCase();
      headers[headerName] = value;
    }
  }
  if (env.CONTENT_TYPE) headers['content-type'] = env.CONTENT_TYPE;
  if (env.CONTENT_LENGTH) headers['content-length'] = env.CONTENT_LENGTH;
  if (!headers['host']) headers['host'] = host;

  // Build request object
  const req = {
    method,
    url: parsedUrl.pathname + parsedUrl.search,
    path: parsedUrl.pathname,
    query: Object.fromEntries(parsedUrl.searchParams),
    headers,
    _rawBody: body,
    ip: env.REMOTE_ADDR || '127.0.0.1',
    protocol,
    secure: protocol === 'https',
    originalUrl: parsedUrl.pathname + parsedUrl.search,
    cookies: parseCookies(headers['cookie'] || ''),
    get(name) { return headers[name.toLowerCase()]; }
  };

  // Load the CGI entry point
  const cgiPath = path.join(__dirname, '..', 'dist', 'cgi.js');
  const cgiModule = require(cgiPath);

  // Create mock response
  const res = {
    _headers: { 'content-type': 'text/html; charset=utf-8' },
    _statusCode: 200,
    _chunks: [],
    locals: {},

    status(code) { this._statusCode = code; return this; },
    sendStatus(code) { this._statusCode = code; this._end(); return this; },
    setHeader(name, value) { this._headers[name.toLowerCase()] = String(value); return this; },
    set(name, value) { return this.setHeader(name, value); },
    get(name) { return this._headers[name.toLowerCase()]; },
    type(type) { this.setHeader('content-type', type); return this; },
    location(url) { this.setHeader('location', url); return this; },

    json(data) {
      const json = JSON.stringify(data);
      this._chunks.push(Buffer.from(json, 'utf-8'));
      this.setHeader('content-type', 'application/json; charset=utf-8');
      this._end();
      return this;
    },

    send(data) {
      if (typeof data === 'string') this._chunks.push(Buffer.from(data, 'utf-8'));
      else if (Buffer.isBuffer(data)) this._chunks.push(data);
      else if (typeof data === 'object') {
        this._chunks.push(Buffer.from(JSON.stringify(data), 'utf-8'));
        this.setHeader('content-type', 'application/json; charset=utf-8');
      }
      this._end();
      return this;
    },

    redirect(url) {
      this._statusCode = 302;
      this._headers['location'] = url;
      this._chunks.push(Buffer.alloc(0));
      this._end();
      return this;
    },

    render(view, data, cb) {
      try {
        const ejs = require('ejs');
        const viewsDir = path.join(__dirname, '..', 'src', 'views');
        const viewPath = path.join(viewsDir, view + '.ejs');

        if (fs.existsSync(viewPath)) {
          const template = fs.readFileSync(viewPath, 'utf-8');
          const renderData = Object.assign({}, this.locals || {}, data || {});
          const html = ejs.render(template, renderData, {
            views: [viewsDir],
            filename: viewPath
          });
          this._chunks.push(Buffer.from(html, 'utf-8'));
        } else {
          this._statusCode = 404;
          this._chunks.push(Buffer.from('View not found: ' + view, 'utf-8'));
        }
      } catch (err) {
        this._statusCode = 500;
        this._chunks.push(Buffer.from('Render error: ' + err.message, 'utf-8'));
      }
      this._end();
      return this;
    },

    sendFile(filePath, options, callback) {
      try {
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
            '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf'
          };
          this._headers['content-type'] = mimeTypes[ext] || 'application/octet-stream';
          this._chunks.push(data);
        } else {
          this._statusCode = 404;
          this._chunks.push(Buffer.from('File not found', 'utf-8'));
        }
      } catch (err) {
        this._statusCode = 500;
        this._chunks.push(Buffer.from('Error: ' + err.message, 'utf-8'));
      }
      this._end();
      if (typeof callback === 'function') callback(null);
      return this;
    },

    end(data) {
      if (data) {
        if (typeof data === 'string') this._chunks.push(Buffer.from(data, 'utf-8'));
        else if (Buffer.isBuffer(data)) this._chunks.push(data);
      }
      this._end();
      return this;
    },

    write(chunk, encoding, callback) {
      if (typeof chunk === 'string') this._chunks.push(Buffer.from(chunk, encoding || 'utf-8'));
      else if (Buffer.isBuffer(chunk)) this._chunks.push(chunk);
      if (typeof callback === 'function') callback();
      return true;
    },

    cookie(name, value, options) {
      // Build Set-Cookie header
      let cookie = `${name}=${value}`;
      if (options) {
        if (options.httpOnly) cookie += '; HttpOnly';
        if (options.secure) cookie += '; Secure';
        if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
        if (options.maxAge) cookie += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
        if (options.path) cookie += `; Path=${options.path}`;
        if (options.domain) cookie += `; Domain=${options.domain}`;
      }
      // Append to existing Set-Cookie headers
      if (!this._setCookies) this._setCookies = [];
      this._setCookies.push(cookie);
      return this;
    },
    clearCookie(name, options) {
      return this.cookie(name, '', Object.assign({}, options, { maxAge: 0 }));
    },
    format(obj) {
      if (obj['text/html']) return obj['text/html']();
      if (obj['application/json']) return obj['application/json']();
      if (obj['default']) return obj['default']();
      return this;
    },

    _end() {
      if (this._ended) return;
      this._ended = true;
      const body = Buffer.concat(this._chunks.length > 0 ? this._chunks : [Buffer.alloc(0)]);
      this._headers['content-length'] = String(body.length);
      // Add Set-Cookie headers
      if (this._setCookies && this._setCookies.length > 0) {
        for (const cookie of this._setCookies) {
          this._headers['set-cookie'] = (this._headers['set-cookie'] || []);
          if (!Array.isArray(this._headers['set-cookie'])) {
            this._headers['set-cookie'] = [this._headers['set-cookie']];
          }
          this._headers['set-cookie'].push(cookie);
        }
      }
      cgiOutput(this._statusCode, this._headers, body);
    }
  };

  // Initialize database and run the app
  try {
    await cgiModule.initDb();
    const app = cgiModule.default || cgiModule.app;

    // Add timeout to detect hangs
    const timeout = setTimeout(() => {
      process.stderr.write('[CGI] Request timed out after 25 seconds\n');
      res._statusCode = 504;
      res._chunks = [Buffer.from('Gateway Timeout', 'utf-8')];
      res._end();
    }, 25000);

    app(req, res, (err) => {
      clearTimeout(timeout);
      if (err) {
        process.stderr.write('[CGI] App error: ' + (err.stack || err.message || err) + '\n');
        res._statusCode = 500;
        res._chunks = [Buffer.from('Internal Server Error: ' + err.message, 'utf-8')];
        res._end();
      }
    });
  } catch (err) {
    process.stderr.write('[CGI] Init error: ' + (err.stack || err.message || err) + '\n');
    res._statusCode = 500;
    res._chunks = [Buffer.from('Error: ' + err.message, 'utf-8')];
    res._end();
  }
}

main().catch(err => {
  const msg = 'Fatal CGI Error: ' + err.message;
  process.stdout.write(
    'Status: 500\r\n' +
    'Content-Type: text/plain; charset=utf-8\r\n' +
    'Content-Length: ' + Buffer.byteLength(msg) + '\r\n' +
    '\r\n' + msg
  );
  process.exit(1);
});
