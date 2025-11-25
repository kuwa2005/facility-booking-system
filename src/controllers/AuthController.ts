import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import AuthService from '../services/AuthService';
import { handleValidationErrors } from '../utils/validation';
import { createError } from '../middleware/errorHandler';

export class AuthController {
  /**
   * Register validation rules
   * デモモード：メールアドレスの形式チェックを無効化
   */
  static registerValidation = [
    body('email').notEmpty().withMessage('Email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    handleValidationErrors,
  ];

  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, organization_name, phone, address } = req.body;

      const result = await AuthService.register({
        email,
        password,
        name,
        organization_name,
        phone,
        address,
      });

      res.status(201).json({
        message: 'Registration successful. Please check your email for verification code.',
        user: result.user,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Verify email validation rules
   */
  static verifyEmailValidation = [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
    handleValidationErrors,
  ];

  /**
   * Verify email with code
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.body;
      const user = await AuthService.verifyEmail(code);

      res.json({
        message: 'Email verified successfully',
        user,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Login validation rules
   * デモモード：メールアドレスの形式チェックを無効化
   */
  static loginValidation = [
    body('email').notEmpty().withMessage('Email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ];

  /**
   * Login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await AuthService.login(email, password, ipAddress, userAgent);

      // Set cookie (optional, for browser-based auth)
      // secureフラグはHTTPS接続の時のみ有効にする
      const useHttps = process.env.APP_URL?.startsWith('https://') || false;
      res.cookie('token', result.token.token, {
        httpOnly: true,
        secure: useHttps, // HTTPSの時のみsecure
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token,
      });
    } catch (error: any) {
      next(createError(error.message, 401));
    }
  }

  /**
   * Logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');

        await AuthService.logout(
          req.user.userId,
          req.user.role,
          req.user.email,
          ipAddress,
          userAgent
        );
      }

      res.clearCookie('token');
      res.json({ message: 'Logout successful' });
    } catch (error: any) {
      // Log the error but still clear the cookie and return success
      console.error('Error logging logout:', error);
      res.clearCookie('token');
      res.json({ message: 'Logout successful' });
    }
  }

  /**
   * Request password reset validation rules
   * デモモード：メールアドレスの形式チェックを無効化
   */
  static requestPasswordResetValidation = [
    body('email').notEmpty().withMessage('Email is required'),
    handleValidationErrors,
  ];

  /**
   * Request password reset
   */
  static async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await AuthService.requestPasswordReset(email);

      res.json({
        message: 'If the email exists, a password reset link will be sent',
      });
    } catch (error: any) {
      // Always return success message to prevent email enumeration
      res.json({
        message: 'If the email exists, a password reset link will be sent',
      });
    }
  }

  /**
   * Reset password validation rules
   */
  static resetPasswordValidation = [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    handleValidationErrors,
  ];

  /**
   * Reset password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      const user = await AuthService.resetPassword(token, password);

      res.json({
        message: 'Password reset successful',
        user,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await AuthService.resendVerificationEmail(email);

      res.json({
        message: 'Verification email sent',
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Change password validation rules
   */
  static changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 1 }).withMessage('New password is required'),
    handleValidationErrors,
  ];

  /**
   * Change password (for logged-in users)
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Authentication required');
      }

      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

      res.json({
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Log staff login attempt by regular user
   * POST /api/auth/log-staff-login-attempt
   */
  static async logStaffLoginAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, email, role } = req.body;

      if (!userId || !email || !role) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
        return;
      }

      // audit_logsテーブルに記録
      const { pool } = await import('../config/database');
      await pool.query(
        `INSERT INTO audit_logs
         (user_id, entity_type, entity_id, action, old_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'security',
          0,
          'create',
          JSON.stringify({
            event: 'unauthorized_staff_login_attempt',
            role: role,
            email: email,
            attempted_url: '/staff/login',
            timestamp: new Date().toISOString(),
            severity: 'warning'
          }),
          req.ip || req.socket.remoteAddress || 'Unknown',
          req.get('user-agent') || 'Unknown'
        ]
      );

      console.warn(
        `[Security Warning] User (ID: ${userId}, Role: ${role}, Email: ${email}) attempted to login via staff login page`
      );

      res.status(200).json({
        success: true,
        message: 'Login attempt logged',
      });
    } catch (error: any) {
      console.error('Error logging staff login attempt:', error);
      // ログ記録失敗でもエラーレスポンスは返さない（UX優先）
      res.status(200).json({
        success: true,
        message: 'Login attempt logged',
      });
    }
  }
}
