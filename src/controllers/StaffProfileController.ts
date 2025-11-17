import { Request, Response, NextFunction } from 'express';
import StaffProfileService from '../services/StaffProfileService';
import { body } from 'express-validator';
import { validationResult } from 'express-validator';

/**
 * 職員プロフィールコントローラー
 */
export class StaffProfileController {
  /**
   * プロフィール取得
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const profile = await StaffProfileService.getProfile(req.user.userId);
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * プロフィール更新
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, nickname, phone, department, position, bio } = req.body;

      const updatedProfile = await StaffProfileService.updateProfile(req.user.userId, {
        name,
        nickname,
        phone,
        department,
        position,
        bio,
      });

      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ニックネーム更新
   */
  static async updateNickname(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { nickname } = req.body;
      if (!nickname) {
        res.status(400).json({ error: 'Nickname is required' });
        return;
      }

      const updatedProfile = await StaffProfileService.updateNickname(req.user.userId, nickname);
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * プロフィール画像アップロード
   */
  static async uploadProfileImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const imagePath = req.file.path.replace(/\\/g, '/');

      const updatedProfile = await StaffProfileService.updateProfileImage(req.user.userId, imagePath);
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * プロフィール画像削除
   */
  static async deleteProfileImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const updatedProfile = await StaffProfileService.deleteProfileImage(req.user.userId);
      res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * バリデーションルール
   */
  static updateProfileValidation = [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('nickname').optional().trim().isLength({ min: 1, max: 100 }),
    body('phone').optional().trim().matches(/^[0-9-+()]+$/),
    body('department').optional().trim().isLength({ max: 100 }),
    body('position').optional().trim().isLength({ max: 100 }),
    body('bio').optional().trim().isLength({ max: 1000 }),
  ];
}
