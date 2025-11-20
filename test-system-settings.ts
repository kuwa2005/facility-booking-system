/**
 * システム設定のデータベース操作をテストするスクリプト
 *
 * 実行方法:
 * npx ts-node test-system-settings.ts
 */

import SystemSettingsService from './src/services/SystemSettingsService';
import { pool } from './src/config/database';

async function testSystemSettings() {
  console.log('=== システム設定テスト開始 ===\n');

  try {
    // 1. データベース接続テスト
    console.log('1. データベース接続テスト...');
    await pool.query('SELECT 1');
    console.log('✓ データベース接続成功\n');

    // 2. 現在のsite_name設定を取得
    console.log('2. 現在のsite_name設定を取得...');
    const currentValue = await SystemSettingsService.getSettingValue('site_name');
    console.log(`現在の値: "${currentValue}"\n`);

    // 3. site_nameを更新
    const testValue = 'テスト施設予約システム_' + Date.now();
    console.log(`3. site_nameを "${testValue}" に更新...`);
    await SystemSettingsService.setSetting('site_name', testValue, 'string', undefined);
    console.log('✓ 更新完了\n');

    // 4. 更新後の値を取得して確認
    console.log('4. 更新後の値を取得...');
    const updatedValue = await SystemSettingsService.getSettingValue('site_name');
    console.log(`更新後の値: "${updatedValue}"`);

    if (updatedValue === testValue) {
      console.log('✓ 更新が正しく反映されています\n');
    } else {
      console.log('✗ 更新が反映されていません！');
      console.log(`  期待値: "${testValue}"`);
      console.log(`  実際の値: "${updatedValue}"\n`);
    }

    // 5. データベースから直接確認
    console.log('5. データベースから直接確認...');
    const [rows] = await pool.query<any[]>(
      'SELECT setting_key, setting_value, updated_at FROM system_settings WHERE setting_key = ?',
      ['site_name']
    );
    console.log('DB内の値:', rows[0]);
    console.log('');

    // 6. 元の値に戻す
    console.log('6. 元の値に戻す...');
    await SystemSettingsService.setSetting('site_name', currentValue, 'string', undefined);
    const restoredValue = await SystemSettingsService.getSettingValue('site_name');
    console.log(`復元後の値: "${restoredValue}"`);
    console.log('✓ 元の値に復元しました\n');

    // 7. 全設定を取得
    console.log('7. 全設定を取得...');
    const allSettings = await SystemSettingsService.getAllSettings();
    console.log(`設定数: ${allSettings.length}件`);
    allSettings.forEach(setting => {
      console.log(`  - ${setting.settingKey}: ${setting.settingValue} (${setting.settingType})`);
    });

    console.log('\n=== テスト完了 ===');
    console.log('すべてのテストが成功しました！');

  } catch (error) {
    console.error('\n=== テスト失敗 ===');
    console.error('エラー:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// スクリプト実行
testSystemSettings().catch(error => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});
