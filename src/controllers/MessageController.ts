import { Request, Response } from 'express';
import { MessageService } from '../services/MessageService';
import { CreateMessageDto } from '../models/types';
import UserActivityLogService from '../services/UserActivityLogService';

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
      const userId = (req as any).user.userId;
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

      // メッセージ送信ログを記録
      if ((req as any).user && (req as any).user.role === 'user') {
        const ipAddress = (req as any).ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');

        await UserActivityLogService.logMessageSend(
          userId,
          message.id,
          data.subject,
          data.content.length,
          ipAddress,
          userAgent
        );
      }

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
   * GET /api/messages?page=1&limit=30
   */
  async getUserMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const includeDeleted = req.query.includeDeleted === 'true';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;

      const messages = await messageService.getUserMessages(
        userId,
        includeDeleted,
        page,
        limit,
      );

      res.json({
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          hasMore: messages.length === limit,
        },
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
      const userId = (req as any).user.userId;
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
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      // roleが'staff'または'admin'の場合はuserTypeを'staff'にする
      const userType = (userRole === 'staff' || userRole === 'admin') ? 'staff' : 'user';
      await messageService.markAsRead(messageId, userId, userType);

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
      const userId = (req as any).user.userId;

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
      if (!(req as any).user || !(req as any).user.userId) {
        res.status(401).json({
          success: false,
          message: '認証が必要です',
        });
        return;
      }

      const userId = (req as any).user.userId;
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

  /**
   * メッセージスレッド取得（一般利用者）
   * GET /api/user/messages/:id/thread
   */
  async getUserMessageThread(req: Request, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id);
      const userId = (req as any).user.userId;

      if (isNaN(messageId)) {
        res.status(400).json({
          success: false,
          message: '無効なメッセージIDです',
        });
        return;
      }

      const thread = await messageService.getMessageThread(messageId);

      // ユーザーがアクセス権限があるメッセージのみフィルタリング
      const filteredThread = thread.filter(msg =>
        (msg.sender_type === 'user' && msg.sender_id === userId) ||
        (msg.recipient_type === 'user' && msg.recipient_id === userId) ||
        msg.sender_type === 'staff' ||
        msg.recipient_type === 'staff'
      );

      res.json({
        success: true,
        data: filteredThread,
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

  // ===== 職員向けエンドポイント =====

  /**
   * メッセージ送信（職員から一般利用者へ）
   * POST /api/staff/messages
   */
  async sendMessageFromStaff(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.userId;
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
   * GET /api/staff/messages?page=1&limit=30
   */
  async getStaffMessages(req: Request, res: Response): Promise<void> {
    try {
      const staffId = (req as any).user.userId;
      const showAll = req.query.showAll === 'true';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;

      // 管理者の場合は全メッセージを表示可能
      const messages = await messageService.getStaffMessages(
        showAll && (req as any).user.role === 'admin' ? undefined : staffId,
        page,
        limit,
      );

      res.json({
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          hasMore: messages.length === limit,
        },
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
      const staffId = (req as any).user.userId;

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
      const staffId = (req as any).user.userId;

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
      const staffId = (req as any).user.userId;
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
   * 一般客からの未読メッセージ数取得（職員向け）
   * GET /api/staff/messages/unread-from-users/count
   */
  async getUnreadCountFromUsers(req: Request, res: Response): Promise<void> {
    try {
      const count = await messageService.getUnreadCountFromUsers();

      res.json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Error fetching unread count from users:', error);
      res.status(500).json({
        success: false,
        message: '未読メッセージ数の取得に失敗しました',
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

  /**
   * お問い合わせメッセージ送信（ログイン中のユーザー）
   * POST /api/contact
   */
  async sendContactMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { name, email, phone, subject, content } = req.body;

      // バリデーション
      if (!subject || !content) {
        res.status(400).json({
          success: false,
          message: '件名と内容は必須です。',
        });
        return;
      }

      // お問い合わせ内容を整形
      const formattedContent = `
【お問い合わせ】

お名前: ${name || '未入力'}
メールアドレス: ${email || '未入力'}
電話番号: ${phone || '未入力'}

お問い合わせ内容:
${content}
      `.trim();

      // 管理者にメッセージを送信（recipient_id: 1 は管理者を想定）
      const message = await messageService.sendMessageFromUser(userId, {
        recipient_id: 1,
        recipient_type: 'staff',
        subject: subject,
        content: formattedContent,
      });

      res.status(201).json({
        success: true,
        message: 'お問い合わせを送信しました',
        data: message,
      });
    } catch (error: any) {
      console.error('Error sending contact message:', error);
      res.status(500).json({
        success: false,
        message: 'お問い合わせの送信に失敗しました',
        error: error.message,
      });
    }
  }

  /**
   * お問い合わせメッセージ送信（非ログインユーザー）
   * POST /api/contact/public
   */
  async sendPublicContactMessage(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone, category, message } = req.body;

      // バリデーション
      if (!name || !email || !category || !message) {
        res.status(400).json({
          success: false,
          message: 'お名前、メールアドレス、お問い合わせ種別、お問い合わせ内容は必須です。',
        });
        return;
      }

      // デモモード：メールアドレスの形式チェックを無効化
      // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      // if (!emailRegex.test(email)) {
      //   res.status(400).json({
      //     success: false,
      //     message: '有効なメールアドレスを入力してください。',
      //   });
      //   return;
      // }

      const categoryLabel = {
        'reservation': '予約について',
        'facility': '施設について',
        'payment': 'お支払いについて',
        'cancel': 'キャンセルについて',
        'system': 'システムについて',
        'other': 'その他'
      };

      // お問い合わせ内容を整形
      const formattedContent = `
【公開お問い合わせ】（未登録ユーザーからのお問い合わせ）

お名前: ${name}
メールアドレス: ${email}
電話番号: ${phone || '未入力'}
お問い合わせ種別: ${categoryLabel[category as keyof typeof categoryLabel] || category}

お問い合わせ内容:
${message}

※このお問い合わせには、記載されているメールアドレス（${email}）宛に返信してください。
      `.trim();

      // データベースに保存（contact_messagesテーブルに保存）
      const pool = (await import('../config/database')).default;

      await pool.query(
        `INSERT INTO contact_messages (name, email, phone, category, message, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [name, email, phone, category, message]
      );

      // 管理者にもメッセージとして通知（システムメッセージとして記録）
      // sender_typeは'staff'、sender_id=1（管理者）として記録し、recipient_id=1（管理者宛）として記録
      await pool.query(
        `INSERT INTO messages (sender_type, sender_id, recipient_type, recipient_id, subject, content, created_at)
         VALUES ('staff', 1, 'staff', 1, ?, ?, NOW())`,
        [`【${categoryLabel[category as keyof typeof categoryLabel]}】${name}様からのお問い合わせ`, formattedContent]
      );

      res.status(201).json({
        success: true,
        message: 'お問い合わせを受け付けました。担当者から折り返しご連絡いたします。',
      });
    } catch (error: any) {
      console.error('Error sending public contact message:', error);
      res.status(500).json({
        success: false,
        message: 'お問い合わせの送信に失敗しました',
        error: error.message,
      });
    }
  }
}
