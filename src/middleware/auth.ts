import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/AuthService';

// Extend Express Request to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        isAdmin: boolean;
        role: 'user' | 'staff' | 'admin';
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header or cookie
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Try to get token from Authorization header
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If not in header, try cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Admin-only middleware
 * Must be used after authenticate middleware
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};

/**
 * Staff or Admin middleware
 * Must be used after authenticate middleware
 * Allows both staff and admin roles
 * 一般ユーザーの場合はログインページにリダイレクト
 */
export const requireStaff = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    // 未認証の場合は職員ログインページにリダイレクト
    res.redirect('/staff/login');
    return;
  }

  if (req.user.role !== 'staff' && req.user.role !== 'admin') {
    // 一般ユーザーの場合は職員ログインページにリダイレクト
    res.redirect('/staff/login?error=access_denied');
    return;
  }

  next();
};

/**
 * User-only middleware (excludes staff and admin)
 * Must be used after authenticate middleware
 * 職員・管理者の場合は職員ページにリダイレクト
 */
export const requireUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    // 未認証の場合は一般ログインページにリダイレクト
    res.redirect('/login');
    return;
  }

  if (req.user.role === 'staff' || req.user.role === 'admin') {
    // 職員・管理者の場合は職員ダッシュボードにリダイレクト
    res.redirect('/staff');
    return;
  }

  next();
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is present, but doesn't require it
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = AuthService.verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    // If optional auth fails, just continue without user
    next();
  }
};
