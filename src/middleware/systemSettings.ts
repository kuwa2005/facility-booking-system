import { Request, Response, NextFunction } from 'express';
import SystemSettingsService from '../services/SystemSettingsService';

/**
 * システム設定をres.localsに追加するミドルウェア
 *
 * すべてのビューでシステム設定を利用可能にする
 */
export async function loadSystemSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 公開用の設定を取得
    const settings = await SystemSettingsService.getPublicSettings();

    // res.localsに追加（すべてのビューで利用可能になる）
    res.locals.siteName = settings.site_name || '施設予約システム（DEMO）';
    res.locals.contactEmail = settings.contact_email || '';
    res.locals.systemSettings = settings;

    // メンテナンスモード状態（職員画面での警告表示用）
    res.locals.isMaintenanceMode = settings.maintenance_mode || false;

    next();
  } catch (error) {
    // エラーが発生してもデフォルト値を設定して続行
    console.error('Error loading system settings:', error);
    res.locals.siteName = '施設予約システム（DEMO）';
    res.locals.contactEmail = '';
    res.locals.systemSettings = {};
    res.locals.isMaintenanceMode = false;
    next();
  }
}
