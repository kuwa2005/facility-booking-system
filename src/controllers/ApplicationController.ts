import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import ApplicationRepository from '../models/ApplicationRepository';
import RoomRepository from '../models/RoomRepository';
import EquipmentRepository from '../models/EquipmentRepository';
import AvailabilityRepository from '../models/AvailabilityRepository';
import {
  calculateTicketMultiplier,
  calculateUsageCharges,
  validateUsageInput,
  calculateApplicationTotal,
} from '../utils/pricing';
import { handleValidationErrors } from '../utils/validation';
import { createError } from '../middleware/errorHandler';
import PaymentService from '../services/PaymentService';
import { emailService } from '../services/EmailService';
import { notificationService } from '../services/NotificationService';
import { CreateApplicationDto, CreateUsageDto } from '../models/types';

export class ApplicationController {
  /**
   * Create application validation rules
   */
  static createValidation = [
    body('applicant_representative').notEmpty().withMessage('Applicant representative is required'),
    body('applicant_phone').notEmpty().withMessage('Applicant phone is required'),
    body('applicant_email').isEmail().withMessage('Valid applicant email is required'),
    body('event_name').notEmpty().withMessage('Event name is required'),
    body('entrance_fee_type').isIn(['free', 'paid']).withMessage('Invalid entrance fee type'),
    body('entrance_fee_amount').isInt({ min: 0 }).withMessage('Entrance fee amount must be non-negative'),
    body('usages').isArray({ min: 1 }).withMessage('At least one usage is required'),
    handleValidationErrors,
  ];

  /**
   * Create a new application
   */
  static async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const applicationDto: CreateApplicationDto = req.body;

      // Calculate ticket multiplier
      const ticketMultiplier = calculateTicketMultiplier(
        applicationDto.entrance_fee_type,
        applicationDto.entrance_fee_amount
      );

      // Process each usage
      const usagesData: any[] = [];
      const equipmentData: any[] = [];
      let totalAmount = 0;

      for (let i = 0; i < applicationDto.usages.length; i++) {
        const usageDto: CreateUsageDto = applicationDto.usages[i];

        // Validate usage input
        const validation = validateUsageInput({
          useMorning: usageDto.use_morning,
          useAfternoon: usageDto.use_afternoon,
          useEvening: usageDto.use_evening,
          useMiddayExtension: usageDto.use_midday_extension,
          useEveningExtension: usageDto.use_evening_extension,
          acRequested: usageDto.ac_requested,
        });

        if (!validation.valid) {
          next(createError(`Usage ${i + 1}: ${validation.error}`, 400));
          return;
        }

        // Get room data
        const room = await RoomRepository.findById(usageDto.room_id);
        if (!room) {
          next(createError(`Room ID ${usageDto.room_id} not found`, 404));
          return;
        }

        // Check for conflicts
        const hasConflict = await ApplicationRepository.checkConflict(
          usageDto.room_id,
          usageDto.date
        );

        if (hasConflict) {
          next(createError(`Room "${room.name}" is not available on ${usageDto.date}`, 409));
          return;
        }

        // Check if date is available
        const dateAvailable = await AvailabilityRepository.checkSlotAvailability(
          usageDto.room_id,
          usageDto.date,
          'morning' // We'll do detailed check below
        );

        // Get equipment data
        const equipmentUsages: any[] = [];
        if (usageDto.equipment && usageDto.equipment.length > 0) {
          const equipmentIds = usageDto.equipment.map((e) => e.equipment_id);
          const equipmentItems = await EquipmentRepository.findByIds(equipmentIds);

          for (const equipDto of usageDto.equipment) {
            const equipment = equipmentItems.find((e) => e.id === equipDto.equipment_id);
            if (!equipment) {
              next(createError(`Equipment ID ${equipDto.equipment_id} not found`, 404));
              return;
            }

            if (equipDto.quantity > equipment.max_quantity) {
              next(
                createError(
                  `Equipment "${equipment.name}" quantity exceeds maximum (${equipment.max_quantity})`,
                  400
                )
              );
              return;
            }

            // Calculate slot count
            let slotCount = 0;
            if (usageDto.use_morning) slotCount++;
            if (usageDto.use_afternoon) slotCount++;
            if (usageDto.use_evening) slotCount++;

            equipmentUsages.push({
              equipmentId: equipment.id,
              priceType: equipment.price_type,
              unitPrice: equipment.unit_price,
              quantity: equipDto.quantity,
              slotCount,
            });
          }
        }

        // Calculate charges for this usage
        const charges = calculateUsageCharges(
          room,
          {
            useMorning: usageDto.use_morning,
            useAfternoon: usageDto.use_afternoon,
            useEvening: usageDto.use_evening,
            useMiddayExtension: usageDto.use_midday_extension,
            useEveningExtension: usageDto.use_evening_extension,
            acRequested: usageDto.ac_requested,
            acHours: undefined, // Will be filled by staff later
          },
          equipmentUsages,
          ticketMultiplier
        );

        totalAmount += charges.subtotalAmount;

        // Prepare usage data for database
        usagesData.push({
          room_id: usageDto.room_id,
          date: usageDto.date,
          use_morning: usageDto.use_morning,
          use_afternoon: usageDto.use_afternoon,
          use_evening: usageDto.use_evening,
          use_midday_extension: usageDto.use_midday_extension,
          use_evening_extension: usageDto.use_evening_extension,
          ac_requested: usageDto.ac_requested,
          ac_hours: null,
          room_base_charge_before_multiplier: charges.roomBaseChargeBeforeMultiplier,
          room_charge_after_multiplier: charges.roomChargeAfterMultiplier,
          equipment_charge: charges.equipmentCharge,
          ac_charge: 0, // Will be calculated later
          subtotal_amount: charges.subtotalAmount,
        });

        // Prepare equipment data
        if (equipmentUsages.length > 0) {
          equipmentData.push({
            usageIndex: i,
            equipment: equipmentUsages.map((e, idx) => ({
              equipment_id: usageDto.equipment[idx].equipment_id,
              quantity: usageDto.equipment[idx].quantity,
              slot_count: e.slotCount,
              line_amount: e.priceType === 'per_slot'
                ? e.unitPrice * e.quantity * e.slotCount
                : e.priceType === 'flat'
                ? e.unitPrice
                : 0,
            })),
          });
        }
      }

      // Create application data
      const applicationData = {
        user_id: req.user?.userId || null,
        applicant_address: applicationDto.applicant_address || null,
        applicant_group_name: applicationDto.applicant_group_name || null,
        applicant_representative: applicationDto.applicant_representative,
        applicant_phone: applicationDto.applicant_phone,
        applicant_email: applicationDto.applicant_email,
        event_name: applicationDto.event_name,
        expected_attendees: applicationDto.expected_attendees || null,
        event_description: applicationDto.event_description || null,
        program_attachment_path: null, // Handle file upload separately
        entrance_fee_type: applicationDto.entrance_fee_type,
        entrance_fee_amount: applicationDto.entrance_fee_amount,
        ticket_multiplier: ticketMultiplier,
        use_digital_signboard: applicationDto.use_digital_signboard || false,
        setup_datetime: applicationDto.setup_datetime ? new Date(applicationDto.setup_datetime) : null,
        meeting_date: applicationDto.meeting_date ? new Date(applicationDto.meeting_date) : null,
        hall_manager_name: applicationDto.hall_manager_name || null,
        hall_manager_phone: applicationDto.hall_manager_phone || null,
        signboard_entrance: applicationDto.signboard_entrance || false,
        signboard_stage: applicationDto.signboard_stage || false,
        open_time: applicationDto.open_time || null,
        start_time: applicationDto.start_time || null,
        end_time: applicationDto.end_time || null,
        remarks: applicationDto.remarks || null,
        total_amount: totalAmount,
        payment_status: 'unpaid' as const,
        payment_provider_id: null,
        cancel_status: 'none' as const,
        cancelled_at: null,
        cancellation_fee: 0,
      };

      // Create application with usages in transaction
      const result = await ApplicationRepository.createWithUsages(
        applicationData,
        usagesData,
        equipmentData
      );

      // TODO: Initiate payment if required
      // For now, we'll mark as unpaid and send confirmation

      // Send confirmation email
      const usageDetails = result.usages
        .map((u, i) => {
          const room = `Room ID: ${u.room_id}`;
          const date = new Date(u.date).toLocaleDateString();
          const slots = [];
          if (u.use_morning) slots.push('Morning');
          if (u.use_afternoon) slots.push('Afternoon');
          if (u.use_evening) slots.push('Evening');
          return `${i + 1}. ${room} - ${date} (${slots.join(', ')}) - ¥${u.subtotal_amount}`;
        })
        .join('\n');

      await emailService.sendReservationConfirmation(
        applicationData.applicant_email,
        applicationData.applicant_representative,
        result.application.id,
        applicationData.event_name,
        totalAmount,
        usageDetails
      );

      await emailService.sendAdminNotification(
        result.application.id,
        applicationData.event_name,
        applicationData.applicant_representative,
        totalAmount
      );

      // Send notification using the new notification service
      if (applicationData.user_id) {
        await notificationService.sendApplicationCreatedNotification(
          result.application.id,
          applicationData.user_id
        );
      }

      res.status(201).json({
        message: 'Application created successfully',
        application: result.application,
        usages: result.usages,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Get application by ID
   */
  static async getApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('Application not found', 404));
        return;
      }

      // Check if user has permission to view this application
      if (!req.user?.isAdmin && result.application.user_id !== req.user?.userId) {
        next(createError('Access denied', 403));
        return;
      }

      res.json(result);
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * Get user's applications
   */
  static async getUserApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('Authentication required', 401));
        return;
      }

      const applications = await ApplicationRepository.findAll();

      // Filter applications belonging to the user
      const userApplications = applications.filter(
        (app) => app.user_id === req.user!.userId
      );

      res.json({ applications: userApplications });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }
}
