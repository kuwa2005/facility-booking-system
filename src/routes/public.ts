import express from 'express';
import { RoomController } from '../controllers/RoomController';
import { ApplicationController } from '../controllers/ApplicationController';
import { ReviewController } from '../controllers/ReviewController';
import { AnnouncementController } from '../controllers/AnnouncementController';
import { MessageController } from '../controllers/MessageController';
import { SystemSettingsController } from '../controllers/SystemSettingsController';
import { HolidayController } from '../controllers/HolidayController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = express.Router();
const announcementController = new AnnouncementController();
const messageController = new MessageController();

// Announcement routes (public - no authentication required)
router.get(
  '/announcements/public',
  announcementController.getPublicAnnouncements.bind(announcementController)
);

// Room routes
router.get('/rooms', RoomController.getRooms);
router.get('/rooms/:id', RoomController.getRoomById);
router.get('/rooms/:id/availability', RoomController.getRoomAvailability);

// Equipment routes
router.get('/equipment', RoomController.getEquipment);

// Review routes (public)
router.get('/rooms/:roomId/reviews', ReviewController.getRoomReviews);
router.get('/reviews/recent', ReviewController.getRecentReviews);

// Application routes
router.post(
  '/applications',
  optionalAuth,
  ApplicationController.createValidation,
  ApplicationController.createApplication
);
router.get('/applications/:id', optionalAuth, ApplicationController.getApplication);
router.get('/my-applications', authenticate, ApplicationController.getUserApplications);

// Contact routes (public)
router.post(
  '/contact/public',
  messageController.sendPublicContactMessage.bind(messageController)
);

// System settings (public - no authentication required)
router.get('/settings/public', SystemSettingsController.getPublicSettings);

// Holidays (public - no authentication required)
router.get('/holidays', HolidayController.getAllHolidays);

export default router;
