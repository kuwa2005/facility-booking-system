import express from 'express';
import { authenticate, requireStaff, requireAdmin } from '../middleware/auth';
import { StaffDashboardController } from '../controllers/StaffDashboardController';
import { StaffProfileController } from '../controllers/StaffProfileController';
import { StaffReservationController } from '../controllers/StaffReservationController';
import { StaffUsageController } from '../controllers/StaffUsageController';
import { StaffUserController } from '../controllers/StaffUserController';
import { StaffFacilityController } from '../controllers/StaffFacilityController';
import { StaffManagementController } from '../controllers/StaffManagementController';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 全ての職員ルートに認証を適用
router.use(authenticate);
router.use(requireStaff);

// プロフィール画像アップロード設定
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const profileImageUpload = multer({
  storage: profileImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// ===== ダッシュボード =====
router.get('/dashboard/stats', StaffDashboardController.getDashboardStats);
router.get('/dashboard/revenue/monthly', StaffDashboardController.getMonthlyRevenueReport);
router.get('/dashboard/rooms/usage-stats', StaffDashboardController.getRoomUsageStats);

// ===== プロフィール =====
router.get('/profile', StaffProfileController.getProfile);
router.patch(
  '/profile',
  StaffProfileController.updateProfileValidation,
  StaffProfileController.updateProfile
);
router.patch('/profile/nickname', StaffProfileController.updateNickname);
router.post(
  '/profile/image',
  profileImageUpload.single('image'),
  StaffProfileController.uploadProfileImage
);
router.delete('/profile/image', StaffProfileController.deleteProfileImage);

// ===== 予約管理 =====
router.get('/reservations', StaffReservationController.getReservations);
router.get('/reservations/:id', StaffReservationController.getReservationDetail);
router.post('/reservations/:id/cancel', StaffReservationController.cancelReservation);
router.patch('/reservations/:id/payment-status', StaffReservationController.updatePaymentStatus);
router.patch('/reservations/:id', StaffReservationController.updateReservation);
router.post('/reservations/:id/notes', StaffReservationController.addNote);
router.get('/reservations/:id/notes', StaffReservationController.getNotes);

// ===== 利用記録管理 =====
router.get('/usages/:id', StaffUsageController.getUsageDetail);
router.patch('/usages/:id/ac-hours', StaffUsageController.updateAcHours);
router.patch('/usages/:id/actual-time', StaffUsageController.updateActualTime);
router.patch('/usages/:id/remarks', StaffUsageController.updateRemarks);
router.get('/usages/today/all', StaffUsageController.getTodayUsages);
router.get('/usages/date-range/all', StaffUsageController.getUsagesByDateRange);
router.get('/usages/missing-ac-hours/all', StaffUsageController.getUsagesWithMissingAcHours);

// ===== 利用者管理 =====
router.get('/users', StaffUserController.getUsers);
router.get('/users/stats/summary', StaffUserController.getUserStatsSummary);
router.get('/users/recent/all', StaffUserController.getRecentUsers);
router.get('/users/:id', StaffUserController.getUserDetail);
router.patch('/users/:id/toggle-active', StaffUserController.toggleUserActive);
router.patch('/users/:id', StaffUserController.updateUser);

// ===== 施設・設備管理 =====

// 部屋管理
router.get('/facilities/rooms', StaffFacilityController.getRooms);
router.post('/facilities/rooms', StaffFacilityController.createRoom);
router.patch('/facilities/rooms/:id', StaffFacilityController.updateRoom);
router.delete('/facilities/rooms/:id', StaffFacilityController.deleteRoom);
router.get('/facilities/rooms/:id/usage-stats', StaffFacilityController.getRoomUsageStats);

// 設備管理
router.get('/facilities/equipment', StaffFacilityController.getEquipment);
router.post('/facilities/equipment', StaffFacilityController.createEquipment);
router.patch('/facilities/equipment/:id', StaffFacilityController.updateEquipment);
router.delete('/facilities/equipment/:id', StaffFacilityController.deleteEquipment);
router.get('/facilities/equipment/:id/usage-stats', StaffFacilityController.getEquipmentUsageStats);

// 休館日管理
router.get('/facilities/closed-dates', StaffFacilityController.getClosedDates);
router.post('/facilities/closed-dates', StaffFacilityController.addClosedDate);
router.delete('/facilities/closed-dates/:id', StaffFacilityController.deleteClosedDate);

// ===== 職員管理（管理者のみ） =====
router.use('/management', requireAdmin);

router.get('/management/staff', StaffManagementController.getStaffList);
router.get('/management/staff/stats/summary', StaffManagementController.getStaffStatsSummary);
router.get('/management/staff/activity/summary', StaffManagementController.getStaffActivitySummary);
router.get('/management/staff/:id', StaffManagementController.getStaffDetail);
router.post('/management/staff', StaffManagementController.createStaff);
router.patch('/management/staff/:id', StaffManagementController.updateStaff);
router.delete('/management/staff/:id', StaffManagementController.deleteStaff);
router.post('/management/staff/:id/reset-password', StaffManagementController.resetStaffPassword);

export default router;
