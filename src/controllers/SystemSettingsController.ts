import { Request, Response, NextFunction } from 'express';
import SystemSettingsService from '../services/SystemSettingsService';

/**
 * システム設定コントローラー
 */
export class SystemSettingsController {
  /**
   * すべての設定を取得（管理者のみ）
   */
  static async getAllSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const settings = await SystemSettingsService.getAllSettings();

      // camelCaseとsnake_caseの両方の形式で返す（互換性のため）
      const formattedSettings: { [key: string]: any } = {};
      for (const setting of settings) {
        formattedSettings[setting.settingKey] = {
          value: await SystemSettingsService.getSettingValue(setting.settingKey),
          type: setting.settingType,
          description: setting.description
        };
      }

      res.json(formattedSettings);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 公開用の設定を取得（認証不要）
   */
  static async getPublicSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SystemSettingsService.getPublicSettings();

      // admin_staff_idが存在する場合、管理者の名前も取得して追加
      if (settings.admin_staff_id) {
        try {
          const pool = (await import('../config/database')).default;
          const [staffRows] = await pool.query(
            'SELECT id, name, role FROM staff WHERE id = ? LIMIT 1',
            [settings.admin_staff_id]
          );

          if (Array.isArray(staffRows) && staffRows.length > 0) {
            const staff: any = staffRows[0];
            settings.admin_staff_name = staff.name;
            settings.admin_staff_role = staff.role;
          }
        } catch (err) {
          console.error('Failed to fetch admin staff info:', err);
          // エラーが発生しても設定自体は返す
        }
      }

      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 基本設定を更新
   */
  static async updateBasicSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[SystemSettingsController] updateBasicSettings called');
      console.log('[SystemSettingsController] User:', req.user);
      console.log('[SystemSettingsController] Body:', req.body);

      if (!req.user || req.user.role !== 'admin') {
        console.log('[SystemSettingsController] Access denied - not admin');
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { siteName, adminEmail, contactPhone, maintenanceMode, adminStaffId, timezone, timezoneOffset } = req.body;
      const staffId = req.user.userId;

      const updates = [];
      if (siteName !== undefined) {
        updates.push({ key: 'site_name', value: siteName, type: 'string' as const });
      }
      if (adminEmail !== undefined) {
        updates.push({ key: 'admin_email', value: adminEmail, type: 'string' as const });
      }
      if (contactPhone !== undefined) {
        updates.push({ key: 'contact_phone', value: contactPhone, type: 'string' as const });
      }
      if (maintenanceMode !== undefined) {
        updates.push({ key: 'maintenance_mode', value: maintenanceMode, type: 'boolean' as const });
      }
      if (adminStaffId !== undefined) {
        updates.push({ key: 'admin_staff_id', value: String(adminStaffId), type: 'number' as const });
      }
      if (timezone !== undefined) {
        updates.push({ key: 'timezone', value: timezone, type: 'string' as const });
      }
      if (timezoneOffset !== undefined) {
        updates.push({ key: 'timezone_offset', value: timezoneOffset, type: 'string' as const });
      }

      console.log('[SystemSettingsController] Updates:', updates);

      await SystemSettingsService.setBulkSettings(updates, staffId);

      console.log('[SystemSettingsController] Settings updated successfully');
      res.json({ message: 'Basic settings updated successfully' });
    } catch (error) {
      console.error('[SystemSettingsController] Error:', error);
      next(error);
    }
  }

  /**
   * 予約設定を更新
   */
  static async updateReservationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const {
        maxReservationDays,
        reservationDeadlineDays,
        cancellationFeeDays,
        cancellationFeeRate,
        requireApproval
      } = req.body;
      const staffId = req.user.userId;

      const updates = [];
      if (maxReservationDays !== undefined) {
        updates.push({ key: 'reservation_advance_days', value: maxReservationDays, type: 'number' as const });
      }
      if (reservationDeadlineDays !== undefined) {
        updates.push({ key: 'reservation_deadline_days', value: reservationDeadlineDays, type: 'number' as const });
      }
      if (cancellationFeeDays !== undefined) {
        updates.push({ key: 'cancellation_fee_days', value: cancellationFeeDays, type: 'number' as const });
      }
      if (cancellationFeeRate !== undefined) {
        updates.push({ key: 'cancellation_fee_rate', value: cancellationFeeRate, type: 'number' as const });
      }
      if (requireApproval !== undefined) {
        updates.push({ key: 'require_approval', value: requireApproval, type: 'boolean' as const });
      }

      await SystemSettingsService.setBulkSettings(updates, staffId);

      res.json({ message: 'Reservation settings updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * メール設定を更新
   */
  static async updateEmailSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const {
        smtpHost,
        smtpPort,
        emailFromName,
        emailFromAddress,
        emailEnabled
      } = req.body;
      const staffId = req.user.userId;

      const updates = [];
      if (smtpHost !== undefined) {
        updates.push({ key: 'smtp_host', value: smtpHost, type: 'string' as const });
      }
      if (smtpPort !== undefined) {
        updates.push({ key: 'smtp_port', value: smtpPort, type: 'number' as const });
      }
      if (emailFromName !== undefined) {
        updates.push({ key: 'email_from_name', value: emailFromName, type: 'string' as const });
      }
      if (emailFromAddress !== undefined) {
        updates.push({ key: 'email_from_address', value: emailFromAddress, type: 'string' as const });
      }
      if (emailEnabled !== undefined) {
        updates.push({ key: 'email_enabled', value: emailEnabled, type: 'boolean' as const });
      }

      await SystemSettingsService.setBulkSettings(updates, staffId);

      res.json({ message: 'Email settings updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 営業時間設定を更新
   */
  static async updateBusinessHours(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { businessHours } = req.body;
      const staffId = req.user.userId;

      await SystemSettingsService.setSetting(
        'business_hours',
        businessHours,
        'json',
        staffId
      );

      res.json({ message: 'Business hours updated successfully' });
    } catch (error) {
      next(error);
    }
  }
}
