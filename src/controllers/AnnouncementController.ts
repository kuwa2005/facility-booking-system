import { Request, Response } from 'express';
import { AnnouncementService } from '../services/AnnouncementService';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from '../models/types';

const announcementService = new AnnouncementService();

/**
 * お知らせコントローラー
 */
export class AnnouncementController {
  /**
   * 公開お知らせ一覧取得（認証不要）
   * GET /api/announcements/public
   */
  async getPublicAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const announcements = await announcementService.getPublicAnnouncements();
      res.json({
        success: true,
        data: announcements,
      });
    } catch (error: any) {
      console.error('Error fetching public announcements:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 一般利用者向けお知らせ一覧取得（認証必要）
   * GET /api/announcements/user
   */
  async getUserAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const announcements = await announcementService.getUserAnnouncements();
      res.json({
        success: true,
        data: announcements,
      });
    } catch (error: any) {
      console.error('Error fetching user announcements:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 職員向け：全お知らせ一覧取得
   * GET /api/staff/announcements
   */
  async getAllAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const announcements =
        await announcementService.getAllAnnouncements(includeInactive);

      res.json({
        success: true,
        data: announcements,
      });
    } catch (error: any) {
      console.error('Error fetching all announcements:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お知らせ詳細取得
   * GET /api/staff/announcements/:id
   */
  async getAnnouncementById(req: Request, res: Response): Promise<void> {
    try {
      const announcementId = parseInt(req.params.id);

      if (isNaN(announcementId)) {
        res.status(400).json({
          success: false,
          message: '無効なお知らせIDです',
        });
        return;
      }

      const announcement =
        await announcementService.getAnnouncementById(announcementId);

      if (!announcement) {
        res.status(404).json({
          success: false,
          message: 'お知らせが見つかりません',
        });
        return;
      }

      res.json({
        success: true,
        data: announcement,
      });
    } catch (error: any) {
      console.error('Error fetching announcement:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お知らせ作成（職員のみ）
   * POST /api/staff/announcements
   */
  async createAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const data: CreateAnnouncementDto = req.body;

      // バリデーション
      if (!data.title || !data.content || !data.announcement_type) {
        res.status(400).json({
          success: false,
          message: 'タイトル、内容、種別は必須です',
        });
        return;
      }

      if (!['public', 'user'].includes(data.announcement_type)) {
        res.status(400).json({
          success: false,
          message: '無効なお知らせ種別です',
        });
        return;
      }

      const announcement = await announcementService.createAnnouncement(
        staffId,
        data,
      );

      res.status(201).json({
        success: true,
        message: 'お知らせを作成しました',
        data: announcement,
      });
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの作成に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お知らせ更新（職員のみ）
   * PATCH /api/staff/announcements/:id
   */
  async updateAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const announcementId = parseInt(req.params.id);
      const updates: UpdateAnnouncementDto = req.body;

      if (isNaN(announcementId)) {
        res.status(400).json({
          success: false,
          message: '無効なお知らせIDです',
        });
        return;
      }

      // お知らせの存在確認
      const announcement =
        await announcementService.getAnnouncementById(announcementId);
      if (!announcement) {
        res.status(404).json({
          success: false,
          message: 'お知らせが見つかりません',
        });
        return;
      }

      await announcementService.updateAnnouncement(
        announcementId,
        staffId,
        updates,
      );

      res.json({
        success: true,
        message: 'お知らせを更新しました',
      });
    } catch (error: any) {
      console.error('Error updating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの更新に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お知らせ削除（職員のみ）
   * DELETE /api/staff/announcements/:id
   */
  async deleteAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const announcementId = parseInt(req.params.id);

      if (isNaN(announcementId)) {
        res.status(400).json({
          success: false,
          message: '無効なお知らせIDです',
        });
        return;
      }

      await announcementService.deleteAnnouncement(announcementId, staffId);

      res.json({
        success: true,
        message: 'お知らせを削除しました',
      });
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせの削除に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お知らせの有効/無効切り替え
   * POST /api/staff/announcements/:id/toggle
   */
  async toggleAnnouncementStatus(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const announcementId = parseInt(req.params.id);
      const { is_active } = req.body;

      if (isNaN(announcementId)) {
        res.status(400).json({
          success: false,
          message: '無効なお知らせIDです',
        });
        return;
      }

      if (typeof is_active !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'is_activeはboolean値である必要があります',
        });
        return;
      }

      await announcementService.toggleAnnouncementStatus(
        announcementId,
        staffId,
        is_active,
      );

      res.json({
        success: true,
        message: `お知らせを${is_active ? '有効' : '無効'}にしました`,
      });
    } catch (error: any) {
      console.error('Error toggling announcement status:', error);
      res.status(500).json({
        success: false,
        message: 'お知らせのステータス変更に失敗しました',
        error: error.message,
      });
    }
  }
}
