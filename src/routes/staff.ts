import express from 'express';
import { authenticate, requireStaff, requireAdmin } from '../middleware/auth';
import { StaffDashboardController } from '../controllers/StaffDashboardController';
import { StaffProfileController } from '../controllers/StaffProfileController';
import { StaffReservationController } from '../controllers/StaffReservationController';
import { StaffUsageController } from '../controllers/StaffUsageController';
import { StaffUserController } from '../controllers/StaffUserController';
import { StaffFacilityController } from '../controllers/StaffFacilityController';
import { StaffManagementController } from '../controllers/StaffManagementController';
import { ExtendedFacilityController } from '../controllers/ExtendedFacilityController';
import { AnnouncementController } from '../controllers/AnnouncementController';
import { MessageController } from '../controllers/MessageController';
import { UserNoteController } from '../controllers/UserNoteController';
import { NotificationController, notificationController } from '../controllers/NotificationController';
import { SystemSettingsController } from '../controllers/SystemSettingsController';
import { ActivityLogController } from '../controllers/ActivityLogController';
import { UserActivityLogController } from '../controllers/UserActivityLogController';
import { HolidayController } from '../controllers/HolidayController';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const announcementController = new AnnouncementController();
const messageController = new MessageController();
const userNoteController = new UserNoteController();

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  },
});

// ===== ダッシュボード =====
router.get('/dashboard/stats', StaffDashboardController.getDashboardStats);
router.get('/dashboard/revenue/monthly', StaffDashboardController.getMonthlyRevenueReport);
router.get('/dashboard/revenue/range', StaffDashboardController.getRevenueByDateRange);
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
router.get('/users/search', StaffUserController.searchUsers);
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
// 注意: display-orderルートは:idルートより前に配置する必要があります
router.patch('/facilities/rooms/display-order', ExtendedFacilityController.updateRoomsDisplayOrder);
router.patch('/facilities/rooms/:id', StaffFacilityController.updateRoom);
router.delete('/facilities/rooms/:id', StaffFacilityController.deleteRoom);
router.post('/facilities/rooms/:id/restore', StaffFacilityController.restoreRoom);
router.delete('/facilities/rooms/:id/permanent', StaffFacilityController.permanentlyDeleteRoom);
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

// ===== 拡張機能 =====

// 時間帯管理
router.get('/timeslots', ExtendedFacilityController.getTimeSlots);
router.post('/timeslots', ExtendedFacilityController.createTimeSlot);
router.patch('/timeslots/:id', ExtendedFacilityController.updateTimeSlot);
router.delete('/timeslots/:id', ExtendedFacilityController.deleteTimeSlot);
router.post('/rooms/:roomId/timeslots/:timeSlotId/prices', ExtendedFacilityController.setRoomTimeSlotPrices);
router.get('/rooms/:roomId/timeslots/prices', ExtendedFacilityController.getRoomTimeSlotPrices);

// 物販管理
router.get('/products', ExtendedFacilityController.getProducts);
router.post('/products', ExtendedFacilityController.createProduct);
router.patch('/products/:id', ExtendedFacilityController.updateProduct);
router.delete('/products/:id', ExtendedFacilityController.deleteProduct);
router.post('/sales', ExtendedFacilityController.createSale);
router.get('/sales', ExtendedFacilityController.getSales);
router.get('/sales/stats', ExtendedFacilityController.getSalesStats);

// 予約代行
router.post('/proxy-reservations/member', ExtendedFacilityController.createProxyReservationForMember);
router.post('/proxy-reservations/guest', ExtendedFacilityController.createProxyReservationForGuest);
router.get('/proxy-reservations', ExtendedFacilityController.getProxyReservations);
router.get('/proxy-reservations/stats', ExtendedFacilityController.getProxyStats);

// 部屋設備管理
router.get('/rooms/:roomId/equipment', ExtendedFacilityController.getRoomEquipment);
router.get('/equipment/:equipmentId/rooms', ExtendedFacilityController.getEquipmentRooms);
router.put('/rooms/:roomId/equipment', ExtendedFacilityController.setRoomEquipmentBulk);
router.put('/equipment/:equipmentId/rooms', ExtendedFacilityController.setEquipmentRoomsBulk);

// 部屋別休館日
router.post('/room-closed-dates', ExtendedFacilityController.addRoomClosedDate);
router.get('/room-closed-dates', ExtendedFacilityController.getRoomClosedDates);
router.delete('/room-closed-dates/:id', ExtendedFacilityController.deleteRoomClosedDate);

// 会員管理（職員用）
router.post('/members/register', ExtendedFacilityController.registerMemberByStaff);
router.delete('/members/:userId/withdraw', ExtendedFacilityController.withdrawMemberByStaff);

// ===== お知らせ管理 =====
router.get('/announcements', announcementController.getAllAnnouncements.bind(announcementController));
router.get('/announcements/:id', announcementController.getAnnouncementById.bind(announcementController));
router.post('/announcements', announcementController.createAnnouncement.bind(announcementController));
router.patch('/announcements/:id', announcementController.updateAnnouncement.bind(announcementController));
router.delete('/announcements/:id', announcementController.deleteAnnouncement.bind(announcementController));
router.post('/announcements/:id/toggle', announcementController.toggleAnnouncementStatus.bind(announcementController));

// ===== メッセージ管理 =====
router.post('/messages', messageController.sendMessageFromStaff.bind(messageController));
router.get('/messages', messageController.getStaffMessages.bind(messageController));
router.get('/messages/stats', messageController.getMessageStats.bind(messageController));
router.get('/messages/user/:userId', messageController.getMessagesByUser.bind(messageController));
router.get('/messages/:id/thread', messageController.getMessageThread.bind(messageController));
router.delete('/messages/:id', messageController.deleteMessageByStaff.bind(messageController));
router.post('/messages/:id/delete', messageController.deleteMessageByStaff.bind(messageController));
router.post('/messages/cleanup', messageController.cleanupExpiredMessages.bind(messageController));

// ===== ユーザーメモ管理 =====
router.get('/users/:userId/notes', userNoteController.getUserNotes.bind(userNoteController));
router.post('/users/:userId/notes', userNoteController.addUserNote.bind(userNoteController));
router.patch('/users/:userId/notes/:noteId', userNoteController.updateUserNote.bind(userNoteController));
router.delete('/users/:userId/notes/:noteId', userNoteController.deleteUserNote.bind(userNoteController));
router.get('/notes/categories', userNoteController.getNoteCountsByCategory.bind(userNoteController));
router.get('/notes/users-by-category/:category', userNoteController.getUsersByNoteCategory.bind(userNoteController));
router.get('/notes/stats', userNoteController.getNoteStats.bind(userNoteController));
router.get('/notes/recent', userNoteController.getRecentNotes.bind(userNoteController));

// ===== 通知管理 =====
router.get('/notifications/templates', notificationController.getAllTemplates.bind(notificationController));
router.get('/notifications/templates/:code', notificationController.getTemplateByCode.bind(notificationController));
router.get('/notifications/settings', notificationController.getAllSettings.bind(notificationController));
router.patch(
  '/notifications/settings/:settingKey',
  NotificationController.updateSettingValidation,
  notificationController.updateSetting.bind(notificationController)
);
router.get('/notifications/logs', notificationController.getNotificationLogs.bind(notificationController));
router.get('/notifications/stats', notificationController.getNotificationStats.bind(notificationController));
router.post(
  '/notifications/test',
  NotificationController.sendTestNotificationValidation,
  notificationController.sendTestNotification.bind(notificationController)
);

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

// ===== システム設定（管理者のみ） =====
router.get('/settings', SystemSettingsController.getAllSettings);
router.post('/settings/basic', SystemSettingsController.updateBasicSettings);
router.post('/settings/reservation', SystemSettingsController.updateReservationSettings);
router.post('/settings/email', SystemSettingsController.updateEmailSettings);
router.post('/settings/business-hours', SystemSettingsController.updateBusinessHours);

// ===== アクティビティログ（管理者のみ） =====
router.get('/activity-logs', ActivityLogController.getLogs);
router.get('/activity-logs/stats', ActivityLogController.getStats);

// ===== ユーザーアクティビティログ（管理者のみ） =====
router.get('/user-activity-logs', UserActivityLogController.getLogs);
router.get('/user-activity-logs/stats', UserActivityLogController.getStats);

// ===== 祝日管理 =====
router.get('/holidays', HolidayController.getAllHolidays);
router.get('/holidays/:id', HolidayController.getHolidayById);
router.post('/holidays', HolidayController.createHoliday);
router.post('/holidays/bulk-register', HolidayController.bulkRegisterYearHolidays);
router.patch('/holidays/:id', HolidayController.updateHoliday);
router.delete('/holidays/:id', HolidayController.deleteHoliday);
router.get('/holidays/check/date', HolidayController.checkHoliday);
router.post('/holidays/check/weekend-or-holidays', HolidayController.checkWeekendOrHolidays);

export default router;
