import express from 'express';
import { UserProfileController, profileImageUpload } from '../controllers/UserProfileController';
import { UserReservationController } from '../controllers/UserReservationController';
import { ReviewController } from '../controllers/ReviewController';
import { AnnouncementController } from '../controllers/AnnouncementController';
import { MessageController } from '../controllers/MessageController';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const announcementController = new AnnouncementController();
const messageController = new MessageController();

// 全てのルートで認証が必要
router.use(authenticate);

// プロフィール管理
router.get('/profile', UserProfileController.getProfile);
router.patch(
  '/profile',
  UserProfileController.updateProfileValidation,
  UserProfileController.updateProfile
);
router.patch(
  '/profile/nickname',
  UserProfileController.updateNicknameValidation,
  UserProfileController.updateNickname
);
router.post(
  '/profile/image',
  profileImageUpload.single('image'),
  UserProfileController.uploadProfileImage
);
router.delete('/profile/image', UserProfileController.deleteProfileImage);
router.delete('/account', UserProfileController.deleteAccount);

// お気に入り部屋
router.get('/favorites/rooms', UserProfileController.getFavoriteRooms);
router.post('/favorites/rooms', UserProfileController.addFavoriteRoom);
router.post('/favorites/rooms/:roomId', UserProfileController.addFavoriteRoom);
router.delete('/favorites/rooms/:roomId', UserProfileController.removeFavoriteRoom);

// 予約管理
router.get('/reservations', UserReservationController.getMyReservations);
router.get('/reservations/:id', UserReservationController.getReservationDetail);
router.get('/reservations/:id/check-modifiable', UserReservationController.checkModifiable);
router.post('/reservations/:id/cancel', UserReservationController.cancelReservation);
router.post('/reservations/:id/payment', UserReservationController.processPayment);
router.patch('/reservations/:id', UserReservationController.modifyReservation);

// レビュー・評価
router.get('/reviews', ReviewController.getUserReviews);
router.post('/reviews', ReviewController.createReviewValidation, ReviewController.createReview);
router.patch('/reviews/:id', ReviewController.updateReviewValidation, ReviewController.updateReview);
router.delete('/reviews/:id', ReviewController.deleteReview);
router.get('/applications/:applicationId/can-review', ReviewController.canReviewApplication);

// お知らせ（一般利用者向け）
router.get(
  '/announcements',
  announcementController.getUserAnnouncements.bind(announcementController)
);

// メッセージ（一般利用者）
router.post(
  '/messages',
  messageController.sendMessageFromUser.bind(messageController)
);
router.get(
  '/messages',
  messageController.getUserMessages.bind(messageController)
);
router.get(
  '/messages/unread/count',
  messageController.getUnreadCount.bind(messageController)
);
router.get(
  '/messages/:id',
  messageController.getMessageById.bind(messageController)
);
router.get(
  '/messages/:id/thread',
  messageController.getUserMessageThread.bind(messageController)
);
router.post(
  '/messages/:id/read',
  messageController.markAsRead.bind(messageController)
);
router.delete(
  '/messages/:id',
  messageController.deleteMessageByUser.bind(messageController)
);
router.post(
  '/messages/:id/delete',
  messageController.deleteMessageByUser.bind(messageController)
);

// お問い合わせ（ログイン中のユーザー）
router.post(
  '/contact',
  messageController.sendContactMessage.bind(messageController)
);

export default router;
