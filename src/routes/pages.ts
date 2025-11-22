import express from 'express';
import { PageController } from '../controllers/PageController';
import { optionalAuth, authenticate, requireUser } from '../middleware/auth';

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

// ユーザーページ（認証必須 + 一般ユーザーのみ）
// 職員・管理者がアクセスした場合は /staff にリダイレクト
router.get('/my-page', authenticate, requireUser, PageController.myPage);
router.get('/my-page/edit', authenticate, requireUser, PageController.editProfile);
router.get('/my-page/change-password', authenticate, requireUser, PageController.changePassword);
router.get('/my-page/create-review', authenticate, requireUser, PageController.createReview);
router.get('/my-page/reviews/:id/edit', authenticate, requireUser, PageController.editReview);
router.get('/my-page/favorites', authenticate, requireUser, PageController.favorites);
router.get('/my-page/announcements', authenticate, requireUser, PageController.announcements);
router.get('/my-page/messages', authenticate, requireUser, PageController.messages);
router.get('/my-page/messages/compose', authenticate, requireUser, PageController.composeMessage);
router.get('/my-reservations', authenticate, requireUser, PageController.myReservations);
router.get('/my-reservations/:id', authenticate, requireUser, PageController.reservationDetail);

// 予約確認・完了ページ（認証必須 + 一般ユーザーのみ）
router.get('/booking/confirm', authenticate, requireUser, PageController.bookingConfirm);
router.get('/booking/payment', authenticate, requireUser, PageController.bookingPayment);
router.get('/booking/success', authenticate, requireUser, PageController.bookingSuccess);

export default router;
