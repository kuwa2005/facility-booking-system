import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database';
import { emailService } from './EmailService';
import {
  NotificationTemplate,
  NotificationLog,
  NotificationSettings,
  SendNotificationDto,
} from '../models/types';

/**
 * 統合通知サービス
 * - テンプレート管理
 * - 通知送信
 * - ログ記録
 */
export class NotificationService {
  
  // ========== テンプレート管理 ==========
  
  async getTemplateByCode(templateCode: string): Promise<NotificationTemplate | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM notification_templates WHERE template_code = ? AND deleted_at IS NULL',
      [templateCode]
    );
    if (rows.length === 0) return null;
    return rows[0] as NotificationTemplate;
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM notification_templates WHERE deleted_at IS NULL ORDER BY template_code'
    );
    return rows as NotificationTemplate[];
  }

  // ========== 変数置換 ==========
  
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp('{{' + key + '}}', 'g');
      rendered = rendered.replace(regex, String(value || ''));
    }
    rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
      return variables[varName] ? content : '';
    });
    rendered = rendered.replace(/{{[^}]+}}/g, '');
    return rendered;
  }

  // ========== 通知送信 ==========
  
  async sendNotification(data: SendNotificationDto): Promise<{ success: boolean; logId?: number; error?: string }> {
    try {
      const setting = await this.getNotificationSetting(data.template_code);
      if (setting && !setting.is_enabled) {
        console.log(`Notification disabled: ${data.template_code}`);
        return { success: false, error: 'Notification is disabled' };
      }

      const template = await this.getTemplateByCode(data.template_code);
      if (!template || !template.is_active) {
        return { success: false, error: 'Template not found or inactive' };
      }

      const recipientEmail = await this.getRecipientEmail(data.recipient_type, data.recipient_id);
      if (!recipientEmail) {
        return { success: false, error: 'Recipient email not found' };
      }

      const subject = this.renderTemplate(template.subject, data.variables || {});
      const bodyText = this.renderTemplate(template.body_text, data.variables || {});
      const bodyHtml = template.body_html ? this.renderTemplate(template.body_html, data.variables || {}) : undefined;

      const logId = await this.createNotificationLog({
        template_code: data.template_code,
        recipient_type: data.recipient_type,
        recipient_id: data.recipient_id,
        recipient_email: recipientEmail,
        subject,
        body_text: bodyText,
        related_entity_type: data.related_entity_type,
        related_entity_id: data.related_entity_id,
      });

      const result = await emailService.sendEmail({
        to: recipientEmail,
        subject,
        text: bodyText,
        html: bodyHtml,
      });

      if (result.success) {
        await this.updateNotificationLogStatus(logId, 'sent', result.messageId);
        return { success: true, logId };
      } else {
        await this.updateNotificationLogStatus(logId, 'failed', undefined, result.error);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('Failed to send notification:', error);
      return { success: false, error: error.message };
    }
  }

  private async getRecipientEmail(recipientType: 'user' | 'staff', recipientId: number): Promise<string | null> {
    const table = recipientType === 'user' ? 'users' : 'staff';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT email FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
      [recipientId]
    );
    return rows.length > 0 ? rows[0].email : null;
  }

  // ========== ログ管理 ==========
  
  private async createNotificationLog(data: {
    template_code: string;
    recipient_type: 'user' | 'staff';
    recipient_id: number;
    recipient_email: string;
    subject: string;
    body_text: string;
    related_entity_type?: string;
    related_entity_id?: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO notification_logs 
       (template_code, notification_type, recipient_type, recipient_id, recipient_email, 
        subject, body_text, status, related_entity_type, related_entity_id)
       VALUES (?, 'email', ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        data.template_code,
        data.recipient_type,
        data.recipient_id,
        data.recipient_email,
        data.subject,
        data.body_text,
        data.related_entity_type || null,
        data.related_entity_id || null,
      ]
    );
    return result.insertId;
  }

  private async updateNotificationLogStatus(
    logId: number,
    status: 'sent' | 'failed',
    messageId?: string,
    error?: string
  ): Promise<void> {
    await pool.query(
      'UPDATE notification_logs SET status = ?, sent_at = ?, error_message = ? WHERE id = ?',
      [status, status === 'sent' ? new Date() : null, error || null, logId]
    );
  }

  async getNotificationLogs(filters?: {
    template_code?: string;
    recipient_type?: 'user' | 'staff';
    recipient_id?: number;
    status?: string;
    limit?: number;
  }): Promise<NotificationLog[]> {
    let query = 'SELECT * FROM notification_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.template_code) {
      query += ' AND template_code = ?';
      params.push(filters.template_code);
    }
    if (filters?.recipient_type) {
      query += ' AND recipient_type = ?';
      params.push(filters.recipient_type);
    }
    if (filters?.recipient_id) {
      query += ' AND recipient_id = ?';
      params.push(filters.recipient_id);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows as NotificationLog[];
  }

  // ========== 通知設定 ==========
  
  private async getNotificationSetting(settingKey: string): Promise<NotificationSettings | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM notification_settings WHERE setting_key = ?',
      [`notify_${settingKey}`]
    );
    return rows.length > 0 ? (rows[0] as NotificationSettings) : null;
  }

  async getAllSettings(): Promise<NotificationSettings[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM notification_settings ORDER BY setting_key'
    );
    return rows as NotificationSettings[];
  }

  async updateSetting(settingKey: string, isEnabled: boolean, staffId: number): Promise<void> {
    await pool.query(
      'UPDATE notification_settings SET is_enabled = ?, updated_by = ? WHERE setting_key = ?',
      [isEnabled, staffId, settingKey]
    );
  }

  // ========== ヘルパーメソッド ==========
  
  async sendApplicationCreatedNotification(applicationId: number, userId: number): Promise<void> {
    const variables = await this.getApplicationVariables(applicationId);
    await this.sendNotification({
      template_code: 'application_created',
      recipient_type: 'user',
      recipient_id: userId,
      variables,
      related_entity_type: 'application',
      related_entity_id: applicationId,
    });
  }

  async sendApplicationApprovedNotification(applicationId: number, userId: number): Promise<void> {
    const variables = await this.getApplicationVariables(applicationId);
    await this.sendNotification({
      template_code: 'application_approved',
      recipient_type: 'user',
      recipient_id: userId,
      variables,
      related_entity_type: 'application',
      related_entity_id: applicationId,
    });
  }

  async sendApplicationRejectedNotification(applicationId: number, userId: number, reason?: string): Promise<void> {
    const variables = await this.getApplicationVariables(applicationId);
    variables.reason = reason || '';
    await this.sendNotification({
      template_code: 'application_rejected',
      recipient_type: 'user',
      recipient_id: userId,
      variables,
      related_entity_type: 'application',
      related_entity_id: applicationId,
    });
  }

  private async getApplicationVariables(applicationId: number): Promise<Record<string, any>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, u.name as user_name, r.name as room_name, u.date as usage_date
       FROM applications a
       LEFT JOIN users us ON a.user_id = us.id
       LEFT JOIN usages u ON a.id = u.application_id
       LEFT JOIN rooms r ON u.room_id = r.id
       WHERE a.id = ?
       LIMIT 1`,
      [applicationId]
    );

    if (rows.length === 0) {
      return {};
    }

    const app = rows[0];
    return {
      application_id: app.id,
      user_name: app.applicant_representative,
      facility_name: app.event_name,
      room_name: app.room_name || '未設定',
      usage_date: app.usage_date ? new Date(app.usage_date).toLocaleDateString('ja-JP') : '未設定',
      time_slots: '午前・午後',
      attendees: app.expected_attendees || 0,
      total_amount: app.total_amount || 0,
    };
  }
}

export const notificationService = new NotificationService();
