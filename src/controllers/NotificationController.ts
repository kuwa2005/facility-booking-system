import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { notificationService } from '../services/NotificationService';

/**
 * 通知管理コントローラー（職員向け）
 * - テンプレート管理
 * - 通知設定
 * - 送信履歴
 * - テスト送信
 */
export class NotificationController {

  // ========== テンプレート管理 ==========

  /**
   * 全テンプレート取得
   */
  async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await notificationService.getAllTemplates();
      res.json({
        success: true,
        data: templates,
      });
    } catch (error: any) {
      console.error('Failed to get templates:', error);
      res.status(500).json({
        success: false,
        error: 'テンプレート取得に失敗しました',
      });
    }
  }

  /**
   * テンプレート詳細取得
   */
  async getTemplateByCode(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const template = await notificationService.getTemplateByCode(code);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'テンプレートが見つかりません',
        });
        return;
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      console.error('Failed to get template:', error);
      res.status(500).json({
        success: false,
        error: 'テンプレート取得に失敗しました',
      });
    }
  }

  // ========== 通知設定管理 ==========

  /**
   * 全設定取得
   */
  async getAllSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await notificationService.getAllSettings();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      console.error('Failed to get settings:', error);
      res.status(500).json({
        success: false,
        error: '設定取得に失敗しました',
      });
    }
  }

  /**
   * 設定更新
   */
  static updateSettingValidation = [
    body('is_enabled').isBoolean().withMessage('is_enabledはboolean型である必要があります'),
  ];

  async updateSetting(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'バリデーションエラー',
          details: errors.array(),
        });
        return;
      }

      const { settingKey } = req.params;
      const { is_enabled } = req.body;
      const staffId = (req as any).staff?.id;

      if (!staffId) {
        res.status(401).json({
          success: false,
          error: '認証が必要です',
        });
        return;
      }

      await notificationService.updateSetting(settingKey, is_enabled, staffId);

      res.json({
        success: true,
        message: '設定を更新しました',
      });
    } catch (error: any) {
      console.error('Failed to update setting:', error);
      res.status(500).json({
        success: false,
        error: '設定更新に失敗しました',
      });
    }
  }

  // ========== 送信履歴 ==========

  /**
   * 通知ログ取得
   */
  async getNotificationLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        template_code,
        recipient_type,
        recipient_id,
        status,
        limit,
      } = req.query;

      const filters: any = {};

      if (template_code) filters.template_code = template_code as string;
      if (recipient_type) filters.recipient_type = recipient_type as 'user' | 'staff';
      if (recipient_id) filters.recipient_id = parseInt(recipient_id as string);
      if (status) filters.status = status as string;
      if (limit) filters.limit = parseInt(limit as string);

      const logs = await notificationService.getNotificationLogs(filters);

      res.json({
        success: true,
        data: logs,
        count: logs.length,
      });
    } catch (error: any) {
      console.error('Failed to get notification logs:', error);
      res.status(500).json({
        success: false,
        error: 'ログ取得に失敗しました',
      });
    }
  }

  // ========== テスト送信 ==========

  /**
   * テスト通知送信
   */
  static sendTestNotificationValidation = [
    body('template_code').notEmpty().withMessage('template_codeは必須です'),
    body('recipient_type').isIn(['user', 'staff']).withMessage('recipient_typeはuserまたはstaffである必要があります'),
    body('recipient_id').isInt({ min: 1 }).withMessage('recipient_idは正の整数である必要があります'),
    body('variables').optional().isObject().withMessage('variablesはオブジェクト型である必要があります'),
  ];

  async sendTestNotification(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'バリデーションエラー',
          details: errors.array(),
        });
        return;
      }

      const {
        template_code,
        recipient_type,
        recipient_id,
        variables,
      } = req.body;

      const result = await notificationService.sendNotification({
        template_code,
        recipient_type,
        recipient_id,
        variables: variables || {},
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'テスト通知を送信しました',
          logId: result.logId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || '通知送信に失敗しました',
        });
      }
    } catch (error: any) {
      console.error('Failed to send test notification:', error);
      res.status(500).json({
        success: false,
        error: 'テスト送信に失敗しました',
      });
    }
  }

  // ========== 統計情報 ==========

  /**
   * 通知統計取得
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const { days = 30 } = req.query;
      const daysNum = parseInt(days as string);

      const allLogs = await notificationService.getNotificationLogs({
        limit: 10000, // 十分大きな数
      });

      // 過去N日間のログをフィルター
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysNum);

      const recentLogs = allLogs.filter(log =>
        new Date(log.created_at) >= cutoffDate
      );

      // 統計計算
      const stats = {
        total: recentLogs.length,
        sent: recentLogs.filter(log => log.status === 'sent').length,
        failed: recentLogs.filter(log => log.status === 'failed').length,
        pending: recentLogs.filter(log => log.status === 'pending').length,
        byTemplate: {} as Record<string, number>,
        byRecipientType: {
          user: recentLogs.filter(log => log.recipient_type === 'user').length,
          staff: recentLogs.filter(log => log.recipient_type === 'staff').length,
        },
      };

      // テンプレート別集計
      recentLogs.forEach(log => {
        if (!stats.byTemplate[log.template_code]) {
          stats.byTemplate[log.template_code] = 0;
        }
        stats.byTemplate[log.template_code]++;
      });

      res.json({
        success: true,
        data: stats,
        period: `過去${daysNum}日間`,
      });
    } catch (error: any) {
      console.error('Failed to get notification stats:', error);
      res.status(500).json({
        success: false,
        error: '統計取得に失敗しました',
      });
    }
  }
}

export const notificationController = new NotificationController();
