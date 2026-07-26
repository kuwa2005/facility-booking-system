// CGI entry point - imports Express app without starting the server
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import routes
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import staffRoutes from './routes/staff';
import pageRoutes from './routes/pages';
import staffPageRoutes from './routes/staff-pages';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();

// Trust proxy
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Health check (before any middleware)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'cgi' });
});

// CORS (simplified)
app.use((req, res, next) => {
  const origin = req.headers.origin || 'https://fbs.geo.jp';
  res.setHeader('Access-Control-Allow-Origin', origin as string);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Favicon redirect
app.get('/favicon.ico', (req, res) => {
  res.redirect(301, '/favicon.svg');
});

// Load system settings inline (simplified, non-async version)
app.use(async (req: any, res: any, next: any) => {
  try {
    const SystemSettingsService = require('./services/SystemSettingsService').default;
    const settings = await SystemSettingsService.getPublicSettings();
    res.locals.siteName = settings.site_name || '施設予約システム';
    res.locals.contactEmail = settings.contact_email || '';
    res.locals.systemSettings = settings;
    res.locals.isMaintenanceMode = settings.maintenance_mode || false;
  } catch (error) {
    res.locals.siteName = '施設予約システム';
    res.locals.contactEmail = '';
    res.locals.systemSettings = {};
    res.locals.isMaintenanceMode = false;
  }
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

// Page routes
app.use('/staff', staffPageRoutes);
app.use('/', pageRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Initialize database
let dbReady = false;
let dbInitPromise: Promise<void> | null = null;

async function initDb() {
  if (dbReady) return;
  if (dbInitPromise) {
    await dbInitPromise;
    return;
  }

  dbInitPromise = (async () => {
    try {
      const { testConnection } = require('./config/database');
      await testConnection();

      // Check if database is already initialized
      const { pool } = require('./config/database');
      const [rows] = await pool.query(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
        [process.env.DB_NAME || 'facility_reservation']
      );
      const tableExists = (rows as any[])[0]?.cnt > 0;

      if (!tableExists) {
        const { runMigrations } = require('./utils/runMigrations');
        await runMigrations();
      }

      dbReady = true;
    } catch (error: any) {
      dbInitPromise = null;
      throw error;
    }
  })();

  await dbInitPromise;
}

export { app, initDb };
export default app;
