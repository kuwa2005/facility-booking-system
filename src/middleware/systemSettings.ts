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
    res.locals.siteName = settings.site_name || '施設予約システム';
    res.locals.contactEmail = settings.contact_email || '';
    res.locals.systemSettings = settings;

    next();
  } catch (error) {
    // エラーが発生してもデフォルト値を設定して続行
    console.error('Error loading system settings:', error);
    res.locals.siteName = '施設予約システム';
    res.locals.contactEmail = '';
    res.locals.systemSettings = {};
    next();
  }
}
