import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import UserProfileService from '../services/UserProfileService';
import { handleValidationErrors } from '../utils/validation';
import { createError } from '../middleware/errorHandler';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// プロフィール画像のアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads/profiles');
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.userId;
    const ext = path.extname(file.originalname);
    const filename = `profile_${userId}_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 許可する画像形式
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('画像ファイルのみアップロード可能です（JPEG, PNG, GIF, WebP）'));
  }
};

export const profileImageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export class UserProfileController {
  /**
   * プロフィール取得
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const profile = await UserProfileService.getProfile(req.user.userId);

      if (!profile) {
        next(createError('ユーザーが見つかりません', 404));
        return;
      }

      res.json({ profile });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * プロフィール更新
   */
  static updateProfileValidation = [
    body('name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('名前は1〜255文字で入力してください'),
    body('nickname').optional().trim().isLength({ min: 1, max: 100 }).withMessage('ニックネームは1〜100文字で入力してください'),
    body('organization_name').optional().trim().isLength({ max: 255 }).withMessage('組織名は255文字以内で入力してください'),
    body('phone').optional().trim().matches(/^[\d\-\(\)\s]+$/).withMessage('電話番号の形式が正しくありません'),
    body('address').optional().trim().isLength({ max: 500 }).withMessage('住所は500文字以内で入力してください'),
    body('bio').optional().trim().isLength({ max: 1000 }).withMessage('自己紹介は1000文字以内で入力してください'),
    handleValidationErrors,
  ];

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { name, nickname, organization_name, phone, address, bio } = req.body;

      const profile = await UserProfileService.updateProfile(req.user.userId, {
        name,
        nickname,
        organization_name,
        phone,
        address,
        bio,
      });

      res.json({
        message: 'プロフィールを更新しました',
        profile,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * ニックネーム更新
   */
  static updateNicknameValidation = [
    body('nickname').trim().isLength({ min: 1, max: 100 }).withMessage('ニックネームは1〜100文字で入力してください'),
    handleValidationErrors,
  ];

  static async updateNickname(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { nickname } = req.body;

      const profile = await UserProfileService.updateNickname(req.user.userId, nickname);

      res.json({
        message: 'ニックネームを更新しました',
        profile,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * プロフィール画像アップロード
   */
  static async uploadProfileImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      if (!req.file) {
        next(createError('画像ファイルが必要です', 400));
        return;
      }

      // 相対パスを保存
      const relativePath = `uploads/profiles/${req.file.filename}`;

      const profile = await UserProfileService.updateProfileImage(req.user.userId, relativePath);

      res.json({
        message: 'プロフィール画像をアップロードしました',
        profile,
        imageUrl: `/${relativePath}`,
      });
    } catch (error: any) {
      // アップロードされたファイルを削除
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      next(createError(error.message, 400));
    }
  }

  /**
   * プロフィール画像削除
   */
  static async deleteProfileImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const profile = await UserProfileService.deleteProfileImage(req.user.userId);

      res.json({
        message: 'プロフィール画像を削除しました',
        profile,
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * アカウント削除（退会）
   */
  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(createError('認証が必要です', 401));
        return;
      }

      const { password } = req.body;

      if (!password) {
        next(createError('パスワードの確認が必要です', 400));
        return;
      }

      // パスワード確認
      const AuthService = (await import('../services/AuthService')).default;
      const UserRepository = (await import('../models/UserRepository')).default;
      const user = await UserRepository.findById(req.user.userId);

      if (!user) {
        next(createError('ユーザーが見つかりません', 404));
        return;
      }

      const isValidPassword = await AuthService.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        next(createError('パスワードが正しくありません', 401));
        return;
      }

      // アカウント削除
      await UserProfileService.deleteAccount(req.user.userId);

      // セッションをクリア
      res.clearCookie('token');

      res.json({
        message: 'アカウントを削除しました',
      });
    } catch (error: any) {
      next(createError(error.message, 400));
    }
  }

  /**
   * お気に入り部屋を追加
   */
  static async addFavoriteRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '認証が必要です',
        });
        return;
      }

      // URLパラメータまたはボディからroomIdを取得
      const roomId = req.params.roomId || req.body.room_id;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: 'room_idが指定されていません',
        });
        return;
      }

      const pool = (await import('../config/database')).default;

      await pool.query(
        `INSERT IGNORE INTO user_favorite_rooms (user_id, room_id) VALUES (?, ?)`,
        [req.user.userId, roomId]
      );

      res.json({
        success: true,
        message: 'お気に入りに追加しました',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'お気に入りの追加に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お気に入り部屋を削除
   */
  static async removeFavoriteRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '認証が必要です',
        });
        return;
      }

      const { roomId } = req.params;
      const pool = (await import('../config/database')).default;

      await pool.query(
        `DELETE FROM user_favorite_rooms WHERE user_id = ? AND room_id = ?`,
        [req.user.userId, roomId]
      );

      res.json({
        success: true,
        message: 'お気に入りから削除しました',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'お気に入りの削除に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お気に入り部屋一覧取得
   */
  static async getFavoriteRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '認証が必要です',
        });
        return;
      }

      const pool = (await import('../config/database')).default;

      const [rooms] = await pool.query(
        `SELECT r.* FROM rooms r
         INNER JOIN user_favorite_rooms f ON r.id = f.room_id
         WHERE f.user_id = ? AND r.is_active = TRUE
         ORDER BY f.created_at DESC`,
        [req.user.userId]
      );

      res.json({
        success: true,
        rooms
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'お気に入りの取得に失敗しました',
        error: error.message,
      });
    }
  }
}
