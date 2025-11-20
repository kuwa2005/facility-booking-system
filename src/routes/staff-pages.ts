import express from 'express';
import { authenticate, requireStaff, requireAdmin } from '../middleware/auth';
import { StaffPageController } from '../controllers/StaffPageController';

const router = express.Router();

// 職員ログインページ（認証不要）
router.get('/login', StaffPageController.login);

// 以降は認証が必要
router.use(authenticate);
router.use(requireStaff);

// ダッシュボード
router.get('/', StaffPageController.dashboard);

// プロフィール
router.get('/profile', StaffPageController.profile);

// 予約管理
router.get('/reservations', StaffPageController.reservations);

// 利用記録管理
router.get('/usages', StaffPageController.usages);

// 利用者管理
router.get('/users', StaffPageController.users);

// 施設管理
router.get('/facilities/rooms', StaffPageController.rooms);
router.get('/facilities/equipment', StaffPageController.equipment);
router.get('/facilities/closed-dates', StaffPageController.closedDates);

// コミュニケーション
router.get('/announcements', StaffPageController.announcements);
router.get('/messages', StaffPageController.messages);

// 追加機能
router.get('/products', StaffPageController.products);
router.get('/proxy-reservations', StaffPageController.proxyReservations);
router.get('/reports', StaffPageController.reports);

// 職員管理（管理者のみ）
router.get('/management', requireAdmin, StaffPageController.staffManagement);

export default router;
