import express from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', AuthController.registerValidation, AuthController.register);
router.post('/verify-email', AuthController.verifyEmailValidation, AuthController.verifyEmail);
router.post('/login', AuthController.loginValidation, AuthController.login);
router.post('/logout', AuthController.logout);
router.post(
  '/request-password-reset',
  AuthController.requestPasswordResetValidation,
  AuthController.requestPasswordReset
);
router.post(
  '/reset-password',
  AuthController.resetPasswordValidation,
  AuthController.resetPassword
);
router.post('/resend-verification', AuthController.resendVerification);

export default router;
