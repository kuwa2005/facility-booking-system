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
router.get('/logout', PageController.logout);

// ユーザーページ（認証必須）
router.get('/my-page', authenticate, PageController.myPage);
router.get('/my-page/edit', authenticate, PageController.editProfile);
router.get('/my-reservations', authenticate, PageController.myReservations);
router.get('/my-reservations/:id', authenticate, PageController.reservationDetail);

export default router;
