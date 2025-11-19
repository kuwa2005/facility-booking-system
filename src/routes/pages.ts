import express from 'express';
import { PageController } from '../controllers/PageController';
import { optionalAuth, authenticate } from '../middleware/auth';

const router = express.Router();

// 公開ページ（認証オプション）
router.get('/', optionalAuth, PageController.home);
router.get('/rooms', optionalAuth, PageController.rooms);
router.get('/rooms/:id', optionalAuth, PageController.roomDetail);
router.get('/availability', optionalAuth, PageController.availability);
router.get('/terms', optionalAuth, PageController.terms);
router.get('/privacy', optionalAuth, PageController.privacy);
router.get('/contact', optionalAuth, PageController.contact);

// 認証ページ
router.get('/register', PageController.register);
router.get('/login', PageController.login);
router.get('/forgot-password', PageController.forgotPassword);
router.get('/logout', PageController.logout);

// ユーザーページ（認証必須）
router.get('/my-page', authenticate, PageController.myPage);
router.get('/my-page/edit', authenticate, PageController.editProfile);
router.get('/my-page/change-password', authenticate, PageController.changePassword);
router.get('/my-page/create-review', authenticate, PageController.createReview);
router.get('/my-page/reviews/:id/edit', authenticate, PageController.editReview);
router.get('/my-page/favorites', authenticate, PageController.favorites);
router.get('/my-reservations', authenticate, PageController.myReservations);
router.get('/my-reservations/:id', authenticate, PageController.reservationDetail);

// 予約確認・完了ページ
router.get('/booking/confirm', authenticate, PageController.bookingConfirm);
router.get('/booking/success', authenticate, PageController.bookingSuccess);

export default router;
