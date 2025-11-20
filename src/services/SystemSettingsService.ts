import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface SystemSetting {
  id: number;
  settingKey: string;
  setting_key?: string;
  settingValue: string;
  setting_value?: string;
  settingType: string;
  setting_type?: string;
  description: string | null;
  updatedBy: number | null;
  updated_by?: number | null;
  updatedAt: Date;
  updated_at?: Date;
}

/**
 * システム設定サービス
 */
export class SystemSettingsService {
  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(setting: any): SystemSetting {
    return {
      id: setting.id,
      settingKey: setting.setting_key,
      settingValue: setting.setting_value,
      settingType: setting.setting_type,
      description: setting.description,
      updatedBy: setting.updated_by,
      updatedAt: setting.updated_at,
    };
  }

  /**
   * すべての設定を取得
   */
  async getAllSettings(): Promise<SystemSetting[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM system_settings ORDER BY setting_key'
    );
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * 設定をキーで取得
   */
  async getSetting(key: string): Promise<SystemSetting | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM system_settings WHERE setting_key = ?',
      [key]
    );
    return rows[0] ? this.toCamelCase(rows[0]) : null;
  }

  /**
   * 設定値を取得（型変換付き）
   */
  async getSettingValue(key: string): Promise<any> {
    const setting = await this.getSetting(key);
    if (!setting) {
      console.log(`[SystemSettings] Setting not found: ${key}`);
      return null;
    }

    console.log(`[SystemSettings] Reading ${key} = ${setting.settingValue} (type: ${setting.settingType})`);

    switch (setting.settingType) {
      case 'number':
        return parseFloat(setting.settingValue);
      case 'boolean':
        return setting.settingValue === 'true';
      case 'json':
        try {
          return JSON.parse(setting.settingValue);
        } catch {
          return null;
        }
      default:
        return setting.settingValue;
    }
  }

  /**
   * 設定を更新または作成
   */
  async setSetting(
    key: string,
    value: any,
    type: 'string' | 'number' | 'boolean' | 'json',
    staffId?: number,
    description?: string
  ): Promise<void> {
    let valueStr: string;

    switch (type) {
      case 'number':
        valueStr = String(value);
        break;
      case 'boolean':
        valueStr = value ? 'true' : 'false';
        break;
      case 'json':
        valueStr = JSON.stringify(value);
        break;
      default:
        valueStr = String(value);
    }

    console.log(`[SystemSettings] Setting ${key} = ${valueStr} (type: ${type}, staffId: ${staffId})`);

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM system_settings WHERE setting_key = ?',
      [key]
    );

    if (existing.length > 0) {
      // 更新
      console.log(`[SystemSettings] Updating existing setting ${key} (id: ${existing[0].id})`);
      const [result] = await pool.query(
        'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
        [valueStr, staffId || null, key]
      );
      console.log(`[SystemSettings] Update result:`, result);
    } else {
      // 新規作成
      console.log(`[SystemSettings] Creating new setting ${key}`);
      const [result] = await pool.query(
        'INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_by) VALUES (?, ?, ?, ?, ?)',
        [key, valueStr, type, description || null, staffId || null]
      );
      console.log(`[SystemSettings] Insert result:`, result);
    }

    // アクティビティログを記録
    if (staffId) {
      try {
        await pool.query(
          `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
           VALUES (?, ?, ?, ?, ?)`,
          [staffId, 'update', 'system_setting', existing[0]?.id || 0, `Setting updated: ${key} = ${valueStr}`]
        );
      } catch (error) {
        console.error(`[SystemSettings] Failed to log activity:`, error);
        // Don't throw - activity log failure shouldn't prevent settings update
      }
    }
  }

  /**
   * 複数の設定を一括更新
   */
  async setBulkSettings(
    settings: { key: string; value: any; type: 'string' | 'number' | 'boolean' | 'json' }[],
    staffId?: number
  ): Promise<void> {
    for (const setting of settings) {
      await this.setSetting(setting.key, setting.value, setting.type, staffId);
    }
  }

  /**
   * メンテナンスモードかどうかを確認
   */
  async isMaintenanceMode(): Promise<boolean> {
    const value = await this.getSettingValue('maintenance_mode');
    return value === true;
  }

  /**
   * サイト名を取得
   */
  async getSiteName(): Promise<string> {
    const value = await this.getSettingValue('site_name');
    return value || '施設予約システム';
  }

  /**
   * 公開用の設定を取得（機密情報を除く）
   */
  async getPublicSettings(): Promise<{ [key: string]: any }> {
    const settings = await this.getAllSettings();

    // 公開しても良い設定のリスト
    const publicKeys = [
      'site_name',
      'reservation_advance_days',
      'cancellation_deadline_hours',
      'require_approval',
      'contact_email',
      'business_hours'
    ];

    const publicSettings: { [key: string]: any } = {};

    for (const setting of settings) {
      if (publicKeys.includes(setting.settingKey)) {
        publicSettings[setting.settingKey] = await this.getSettingValue(setting.settingKey);
      }
    }

    return publicSettings;
  }
}

export default new SystemSettingsService();
