import express from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticate, requireAdmin);

// Application management
router.get('/applications', AdminController.getApplications);
router.get('/applications/:id', AdminController.getApplicationDetail);
router.patch('/applications/:id', AdminController.updateApplication);
router.post('/applications/:id/cancel', AdminController.cancelApplication);

// Usage management
router.patch('/usages/:usageId/ac-hours', AdminController.updateAcHours);

// Room management
router.get('/rooms', AdminController.getAllRooms);
router.post('/rooms', AdminController.createRoom);
router.patch('/rooms/:id', AdminController.updateRoom);
router.delete('/rooms/:id', AdminController.deleteRoom);

// Equipment management
router.get('/equipment', AdminController.getAllEquipment);
router.post('/equipment', AdminController.createEquipment);
router.patch('/equipment/:id', AdminController.updateEquipment);
router.delete('/equipment/:id', AdminController.deleteEquipment);

export default router;
