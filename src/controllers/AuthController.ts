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
      const result = await AuthService.login(email, password);

      // Set cookie (optional, for browser-based auth)
      res.cookie('token', result.token.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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
  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ message: 'Logout successful' });
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
}
