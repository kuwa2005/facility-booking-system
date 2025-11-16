import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import UserRepository from '../models/UserRepository';
import { User, CreateUserDto } from '../models/types';
import EmailService from './EmailService';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthToken {
  token: string;
  expiresIn: string;
}

export interface AuthResult {
  user: Omit<User, 'password_hash'>;
  token: AuthToken;
}

export class AuthService {
  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  generateToken(userId: number, email: string, isAdmin: boolean = false): AuthToken {
    const token = jwt.sign(
      { userId, email, isAdmin },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      expiresIn: JWT_EXPIRES_IN,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { userId: number; email: string; isAdmin: boolean } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        isAdmin: decoded.isAdmin || false,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate random verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate random token for password reset
   */
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Remove password hash from user object
   */
  sanitizeUser(user: User): Omit<User, 'password_hash'> {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Register a new user
   */
  async register(data: CreateUserDto): Promise<{ user: Omit<User, 'password_hash'>; verificationCode: string }> {
    // Check if email already exists
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    // Hash password
    const password_hash = await this.hashPassword(data.password);

    // Create user
    const user = await UserRepository.create({
      ...data,
      password_hash,
    });

    // Generate and save verification code
    const verificationCode = this.generateVerificationCode();
    await UserRepository.setVerificationCode(user.id, verificationCode, 15); // 15 minutes expiry

    // Send verification email
    await EmailService.sendVerificationEmail(user.email, user.name, verificationCode);

    return {
      user: this.sanitizeUser(user),
      verificationCode, // In production, don't return this in the response
    };
  }

  /**
   * Verify email with code
   */
  async verifyEmail(code: string): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findByVerificationCode(code);
    if (!user) {
      throw new Error('Invalid or expired verification code');
    }

    await UserRepository.markEmailVerified(user.id);

    const updatedUser = await UserRepository.findById(user.id);
    if (!updatedUser) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Login
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    const isValidPassword = await this.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email, user.is_admin);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      // Don't reveal that the email doesn't exist
      throw new Error('If the email exists, a password reset link will be sent');
    }

    const resetToken = this.generateResetToken();
    await UserRepository.setPasswordResetToken(user.id, resetToken, 60); // 60 minutes expiry

    // Send password reset email
    await EmailService.sendPasswordResetEmail(user.email, user.name, resetToken);

    return { resetToken }; // In production, don't return this in the response
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findByResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await UserRepository.resetPassword(user.id, newPasswordHash);

    const updatedUser = await UserRepository.findById(user.id);
    if (!updatedUser) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await UserRepository.update(userId, { password_hash: newPasswordHash });
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ verificationCode: string }> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.email_verified) {
      throw new Error('Email already verified');
    }

    const verificationCode = this.generateVerificationCode();
    await UserRepository.setVerificationCode(user.id, verificationCode, 15);

    await EmailService.sendVerificationEmail(user.email, user.name, verificationCode);

    return { verificationCode }; // In production, don't return this in the response
  }
}

export default new AuthService();
