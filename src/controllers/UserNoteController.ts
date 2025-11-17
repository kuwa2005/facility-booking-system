import { Request, Response } from 'express';
import { UserNoteService } from '../services/UserNoteService';
import { CreateUserNoteDto } from '../models/types';

const userNoteService = new UserNoteService();

/**
 * ユーザーメモコントローラー（職員専用）
 */
export class UserNoteController {
  /**
   * ユーザーのメモ一覧取得
   * GET /api/staff/users/:userId/notes
   */
  async getUserNotes(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const includeDeleted = req.query.includeDeleted === 'true';

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: '無効なユーザーIDです',
        });
        return;
      }

      const notes = await userNoteService.getUserNotes(
        userId,
        includeDeleted,
      );

      res.json({
        success: true,
        data: notes,
      });
    } catch (error: any) {
      console.error('Error fetching user notes:', error);
      res.status(500).json({
        success: false,
        message: 'ユーザーメモの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * ユーザーメモ追加
   * POST /api/staff/users/:userId/notes
   */
  async addUserNote(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const staffId = (req as any).user.id;
      const data: CreateUserNoteDto = req.body;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: '無効なユーザーIDです',
        });
        return;
      }

      // バリデーション
      if (!data.note_content) {
        res.status(400).json({
          success: false,
          message: 'メモ内容は必須です',
        });
        return;
      }

      const note = await userNoteService.addUserNote(userId, staffId, data);

      res.status(201).json({
        success: true,
        message: 'ユーザーメモを追加しました',
        data: note,
      });
    } catch (error: any) {
      console.error('Error adding user note:', error);
      res.status(500).json({
        success: false,
        message: 'ユーザーメモの追加に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * ユーザーメモ更新
   * PATCH /api/staff/users/:userId/notes/:noteId
   */
  async updateUserNote(req: Request, res: Response): Promise<void> {
    try {
      const noteId = parseInt(req.params.noteId);
      const staffId = (req as any).user.id;
      const updates: Partial<CreateUserNoteDto> = req.body;

      if (isNaN(noteId)) {
        res.status(400).json({
          success: false,
          message: '無効なメモIDです',
        });
        return;
      }

      await userNoteService.updateUserNote(noteId, staffId, updates);

      res.json({
        success: true,
        message: 'ユーザーメモを更新しました',
      });
    } catch (error: any) {
      console.error('Error updating user note:', error);
      res.status(500).json({
        success: false,
        message: 'ユーザーメモの更新に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * ユーザーメモ削除
   * DELETE /api/staff/users/:userId/notes/:noteId
   */
  async deleteUserNote(req: Request, res: Response): Promise<void> {
    try {
      const noteId = parseInt(req.params.noteId);
      const staffId = (req as any).user.id;

      if (isNaN(noteId)) {
        res.status(400).json({
          success: false,
          message: '無効なメモIDです',
        });
        return;
      }

      await userNoteService.deleteUserNote(noteId, staffId);

      res.json({
        success: true,
        message: 'ユーザーメモを削除しました',
      });
    } catch (error: any) {
      console.error('Error deleting user note:', error);
      res.status(500).json({
        success: false,
        message: 'ユーザーメモの削除に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * カテゴリ別メモ件数取得
   * GET /api/staff/notes/categories
   */
  async getNoteCountsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId
        ? parseInt(req.query.userId as string)
        : undefined;

      if (userId !== undefined && isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: '無効なユーザーIDです',
        });
        return;
      }

      const counts =
        await userNoteService.getNoteCountsByCategory(userId);

      res.json({
        success: true,
        data: counts,
      });
    } catch (error: any) {
      console.error('Error fetching note counts by category:', error);
      res.status(500).json({
        success: false,
        message: 'カテゴリ別メモ件数の取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 特定カテゴリのメモを持つユーザー一覧取得
   * GET /api/staff/notes/users-by-category/:category
   */
  async getUsersByNoteCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category;

      if (!category) {
        res.status(400).json({
          success: false,
          message: 'カテゴリは必須です',
        });
        return;
      }

      const users = await userNoteService.getUsersByNoteCategory(category);

      res.json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      console.error('Error fetching users by note category:', error);
      res.status(500).json({
        success: false,
        message: 'カテゴリ別ユーザーの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メモ統計取得
   * GET /api/staff/notes/stats
   */
  async getNoteStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await userNoteService.getNoteStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error fetching note stats:', error);
      res.status(500).json({
        success: false,
        message: 'メモ統計の取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 最近追加されたメモ取得
   * GET /api/staff/notes/recent
   */
  async getRecentNotes(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : 10;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'limitは1から100の間で指定してください',
        });
        return;
      }

      const notes = await userNoteService.getRecentNotes(limit);

      res.json({
        success: true,
        data: notes,
      });
    } catch (error: any) {
      console.error('Error fetching recent notes:', error);
      res.status(500).json({
        success: false,
        message: '最近のメモの取得に失敗しました',
        error: error.message,
      });
    }
  }
}
