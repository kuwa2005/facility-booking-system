import express, { Application } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Import database
import { testConnection } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, configure properly in production
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.APP_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// Serve basic HTML pages (for demonstration)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Facility Reservation System</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #2563eb; }
        .links { margin-top: 30px; }
        .links a {
          display: inline-block;
          margin-right: 20px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
        }
        .links a:hover { text-decoration: underline; }
        .section {
          margin-top: 30px;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <h1>施設予約システム</h1>
      <p>Facility Reservation System - API Server</p>

      <div class="section">
        <h2>API Endpoints</h2>
        <p><strong>Public API:</strong></p>
        <ul>
          <li>GET /api/rooms - List all rooms</li>
          <li>GET /api/rooms/:id/availability - Check room availability</li>
          <li>GET /api/equipment - List all equipment</li>
          <li>POST /api/applications - Create reservation</li>
        </ul>

        <p><strong>Authentication:</strong></p>
        <ul>
          <li>POST /api/auth/register - User registration</li>
          <li>POST /api/auth/login - User login</li>
          <li>POST /api/auth/logout - User logout</li>
        </ul>

        <p><strong>Admin API:</strong></p>
        <ul>
          <li>GET /api/admin/applications - List all applications</li>
          <li>GET /api/admin/rooms - Manage rooms</li>
          <li>GET /api/admin/equipment - Manage equipment</li>
        </ul>
      </div>

      <div class="section">
        <h2>Documentation</h2>
        <p>For detailed API documentation and usage examples, see the README.md file.</p>
        <p>Health check: <a href="/health">/health</a></p>
      </div>
    </body>
    </html>
  `);
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Start listening
    app.listen(PORT, HOST, () => {
      console.log('='.repeat(50));
      console.log('Facility Reservation System');
      console.log('='.repeat(50));
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Server running at: http://${HOST}:${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/health`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;
