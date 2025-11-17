import { Request, Response } from 'express';
import { MessageService } from '../services/MessageService';
import { CreateMessageDto } from '../models/types';

const messageService = new MessageService();

/**
 * メッセージコントローラー
 */
export class MessageController {
  /**
   * メッセージ送信（一般利用者から職員へ）
   * POST /api/messages
   */
  async sendMessageFromUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const data: CreateMessageDto = req.body;

      // バリデーション
      if (
        !data.recipient_id ||
        !data.subject ||
        !data.content ||
        data.recipient_type !== 'staff'
      ) {
        res.status(400).json({
          success: false,
          message: '受信者ID、件名、内容は必須です。職員にのみ送信できます。',
        });
        return;
      }

      const message = await messageService.sendMessageFromUser(userId, data);

      res.status(201).json({
        success: true,
        message: 'メッセージを送信しました',
        data: message,
      });
    } catch (error: any) {
      console.error('Error sending message from user:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの送信に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 自分のメッセージ一覧取得（一般利用者）
   * GET /api/messages
   */
  async getUserMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const includeDeleted = req.query.includeDeleted === 'true';

      const messages = await messageService.getUserMessages(
        userId,
        includeDeleted,
      );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      console.error('Error fetching user messages:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メッセージ詳細取得
   * GET /api/messages/:id
   */
  async getMessageById(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      const message = await messageService.getMessageById(messageId);

      if (!message) {
        res.status(404).json({
          success: false,
          message: 'メッセージが見つかりません',
        });
        return;
      }

      // アクセス権限チェック
      const isAuthorized =
        (message.sender_type === 'user' && message.sender_id === userId) ||
        (message.recipient_type === 'user' && message.recipient_id === userId) ||
        userRole === 'staff' ||
        userRole === 'admin';

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          message: 'このメッセージにアクセスする権限がありません',
        });
        return;
      }

      res.json({
        success: true,
        data: message,
      });
    } catch (error: any) {
      console.error('Error fetching message:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メッセージを既読にする
   * POST /api/messages/:id/read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      await messageService.markAsRead(messageId, userId);

      res.json({
        success: true,
        message: 'メッセージを既読にしました',
      });
    } catch (error: any) {
      console.error('Error marking message as read:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの既読処理に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メッセージ削除（一般利用者）
   * DELETE /api/messages/:id
   */
  async deleteMessageByUser(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.id;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      await messageService.deleteMessage(messageId, userId, 'user');

      res.json({
        success: true,
        message: 'メッセージを削除しました',
      });
    } catch (error: any) {
      console.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの削除に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 未読メッセージ数取得
   * GET /api/messages/unread/count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const count = await messageService.getUnreadCount(userId, 'user');

      res.json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        message: '未読メッセージ数の取得に失敗しました',
        error: error.message,
      });
    }
  }

  // ===== 職員向けエンドポイント =====

  /**
   * メッセージ送信（職員から一般利用者へ）
   * POST /api/staff/messages
   */
  async sendMessageFromStaff(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const data: CreateMessageDto = req.body;

      // バリデーション
      if (
        !data.recipient_id ||
        !data.subject ||
        !data.content ||
        data.recipient_type !== 'user'
      ) {
        res.status(400).json({
          success: false,
          message: '受信者ID、件名、内容は必須です。一般利用者にのみ送信できます。',
        });
        return;
      }

      const message = await messageService.sendMessageFromStaff(staffId, data);

      res.status(201).json({
        success: true,
        message: 'メッセージを送信しました',
        data: message,
      });
    } catch (error: any) {
      console.error('Error sending message from staff:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの送信に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 職員が関わるメッセージ一覧取得
   * GET /api/staff/messages
   */
  async getStaffMessages(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const showAll = req.query.showAll === 'true';

      // 管理者の場合は全メッセージを表示可能
      const messages = await messageService.getStaffMessages(
        showAll && (req as any).user.role === 'admin' ? undefined : staffId,
      );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      console.error('Error fetching staff messages:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 特定ユーザーとのメッセージ履歴取得
   * GET /api/staff/messages/user/:userId
   */
  async getMessagesByUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const staffId = (req as any).user.id;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          message: '無効なユーザーIDです',
        });
        return;
      }

      const messages = await messageService.getMessagesByUser(userId, staffId);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      console.error('Error fetching messages by user:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メッセージスレッド取得
   * GET /api/staff/messages/:id/thread
   */
  async getMessageThread(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      const thread = await messageService.getMessageThread(messageId);

      res.json({
        success: true,
        data: thread,
      });
    } catch (error: any) {
      console.error('Error fetching message thread:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージスレッドの取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メッセージ削除（職員）
   * DELETE /api/staff/messages/:id
   */
  async deleteMessageByStaff(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const staffId = (req as any).user.id;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      await messageService.deleteMessage(messageId, staffId, 'staff');

      res.json({
        success: true,
        message: 'メッセージを削除しました',
      });
    } catch (error: any) {
      console.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージの削除に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * メッセージ統計取得
   * GET /api/staff/messages/stats
   */
  async getMessageStats(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.id;
      const showAll = req.query.showAll === 'true';

      const stats = await messageService.getMessageStats(
        showAll && (req as any).user.role === 'admin' ? undefined : staffId,
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error fetching message stats:', error);
      res.status(500).json({
        success: false,
        message: 'メッセージ統計の取得に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * 有効期限切れ未読メッセージの削除
   * POST /api/staff/messages/cleanup
   */
  async cleanupExpiredMessages(req: Request, res: Response): Promise<void> {
    try {
      const deletedCount =
        await messageService.cleanupExpiredUnreadMessages();

      res.json({
        success: true,
        message: `${deletedCount}件の期限切れメッセージを削除しました`,
        data: { deletedCount },
      });
    } catch (error: any) {
      console.error('Error cleaning up expired messages:', error);
      res.status(500).json({
        success: false,
        message: '期限切れメッセージの削除に失敗しました',
        error: error.message,
      });
    }
  }
}
