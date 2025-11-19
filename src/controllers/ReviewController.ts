import { Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import ReviewRepository from '../models/ReviewRepository';
import ApplicationRepository from '../models/ApplicationRepository';
import { handleValidationErrors } from '../utils/validation';
import { createError } from '../middleware/errorHandler';

/**
 * Review controller for handling room reviews
 */
export class ReviewController {
  /**
   * Create review validation rules
   */
  static createReviewValidation = [
    body('room_id').isInt({ min: 1 }).withMessage('Valid room ID is required'),
    body('application_id').optional().isInt({ min: 1 }).withMessage('Valid application ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required (max 200 characters)'),
    body('comment').optional().trim().isLength({ max: 5000 }).withMessage('Comment is too long (max 5000 characters)'),
    handleValidationErrors,
  ];

  /**
   * Create a new review
   */
  static async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('Authentication required', 401));
        return;
      }

      const { room_id, application_id, rating, title, comment } = req.body;

      // If application_id is provided, verify it belongs to the user and is completed
      if (application_id) {
        const result = await ApplicationRepository.findByIdWithDetails(application_id);
        if (!result) {
          next(createError('Application not found', 404));
          return;
        }

        if (result.application.user_id !== req.user.userId) {
          next(createError('You can only review your own reservations', 403));
          return;
        }

        // Check if already reviewed
        const hasReviewed = await ReviewRepository.hasUserReviewedApplication(req.user.userId, application_id);
        if (hasReviewed) {
          next(createError('You have already reviewed this reservation', 400));
          return;
        }

        // Verify the reservation is completed (past date)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isCompleted = result.usages.every((usage) => {
          const usageDate = new Date(usage.date);
          usageDate.setHours(0, 0, 0, 0);
          return usageDate < today;
        });

        if (!isCompleted) {
          next(createError('You can only review completed reservations', 400));
          return;
        }
      }

      const review = await ReviewRepository.create(req.user.userId, {
        room_id,
        application_id,
        rating,
        title,
        comment,
      });

      res.status(201).json({
        message: 'Review created successfully',
        review,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Update review validation rules
   */
  static updateReviewValidation = [
    param('id').isInt({ min: 1 }).withMessage('Valid review ID is required'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('comment').optional().trim().isLength({ max: 5000 }).withMessage('Comment is too long (max 5000 characters)'),
    handleValidationErrors,
  ];

  /**
   * Update a review
   */
  static async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('Authentication required', 401));
        return;
      }

      const reviewId = parseInt(req.params.id, 10);
      const review = await ReviewRepository.findById(reviewId);

      if (!review) {
        next(createError('Review not found', 404));
        return;
      }

      if (review.user_id !== req.user.userId) {
        next(createError('You can only update your own reviews', 403));
        return;
      }

      const { rating, title, comment } = req.body;

      await ReviewRepository.update(reviewId, {
        rating,
        title,
        comment,
      });

      const updatedReview = await ReviewRepository.findById(reviewId);

      res.json({
        message: 'Review updated successfully',
        review: updatedReview,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Delete a review
   */
  static async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('Authentication required', 401));
        return;
      }

      const reviewId = parseInt(req.params.id, 10);
      const review = await ReviewRepository.findById(reviewId);

      if (!review) {
        next(createError('Review not found', 404));
        return;
      }

      if (review.user_id !== req.user.userId && !req.user.isAdmin) {
        next(createError('You can only delete your own reviews', 403));
        return;
      }

      await ReviewRepository.delete(reviewId);

      res.json({
        message: 'Review deleted successfully',
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Get reviews for a room
   */
  static async getRoomReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomId = parseInt(req.params.roomId, 10);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const reviews = await ReviewRepository.findByRoomIdWithUser(roomId, limit, offset);
      const stats = await ReviewRepository.getAverageRating(roomId);
      const distribution = await ReviewRepository.getRatingDistribution(roomId);

      res.json({
        reviews,
        stats: {
          average: parseFloat(stats.average.toFixed(1)),
          count: stats.count,
          distribution,
        },
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Get user's reviews
   */
  static async getUserReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('Authentication required', 401));
        return;
      }

      const reviews = await ReviewRepository.findByUserId(req.user.userId);

      res.json({
        reviews,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Get recent reviews (public)
   */
  static async getRecentReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const reviews = await ReviewRepository.getRecentReviews(limit);

      res.json({
        reviews,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * Check if user can review an application
   */
  static async canReviewApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('Authentication required', 401));
        return;
      }

      const applicationId = parseInt(req.params.applicationId, 10);
      const result = await ApplicationRepository.findByIdWithDetails(applicationId);

      if (!result) {
        next(createError('Application not found', 404));
        return;
      }

      if (result.application.user_id !== req.user.userId) {
        res.json({ canReview: false, reason: 'Not your reservation' });
        return;
      }

      // Check if already reviewed
      const hasReviewed = await ReviewRepository.hasUserReviewedApplication(req.user.userId, applicationId);
      if (hasReviewed) {
        res.json({ canReview: false, reason: 'Already reviewed' });
        return;
      }

      // Check if completed
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isCompleted = result.usages.every((usage) => {
        const usageDate = new Date(usage.date);
        usageDate.setHours(0, 0, 0, 0);
        return usageDate < today;
      });

      if (!isCompleted) {
        res.json({ canReview: false, reason: 'Reservation not completed yet' });
        return;
      }

      res.json({ canReview: true });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }
}
