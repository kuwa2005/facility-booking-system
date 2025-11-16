import express from 'express';
import { RoomController } from '../controllers/RoomController';
import { ApplicationController } from '../controllers/ApplicationController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Room routes
router.get('/rooms', RoomController.getRooms);
router.get('/rooms/:id', RoomController.getRoomById);
router.get('/rooms/:id/availability', RoomController.getRoomAvailability);

// Equipment routes
router.get('/equipment', RoomController.getEquipment);

// Application routes
router.post(
  '/applications',
  optionalAuth,
  ApplicationController.createValidation,
  ApplicationController.createApplication
);
router.get('/applications/:id', optionalAuth, ApplicationController.getApplication);
router.get('/my-applications', authenticate, ApplicationController.getUserApplications);

export default router;
