import pool from '../config/database';
import fs from 'fs/promises';
import path from 'path';

/**
 * データベースマイグレーションを実行
 */
export async function runMigrations(): Promise<void> {
  let connection;
  try {
    console.log('🔄 マイグレーションを開始します...');

    connection = await pool.getConnection();

    // migrationsテーブルが存在しない場合は作成
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // migrationsディレクトリからすべてのSQLファイルを読み込む
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    console.log(`📁 ${sqlFiles.length}個のマイグレーションファイルが見つかりました`);

    let executedCount = 0;
    let skippedCount = 0;

    for (const file of sqlFiles) {
      // 既に実行済みかチェック
      const [executed] = await connection.query(
        'SELECT * FROM migrations WHERE filename = ?',
        [file]
      );

      if ((executed as any[]).length > 0) {
        console.log(`   ⊘ ${file} - スキップ（実行済み）`);
        skippedCount++;
        continue;
      }

      console.log(`   ▶ ${file} を実行中...`);

      // SQLファイルを読み込んで実行
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');

      try {
        // 複数のステートメントを分割して実行
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement) {
            await connection.query(statement);
          }
        }

        // 実行済みとして記録
        await connection.query(
          'INSERT INTO migrations (filename) VALUES (?)',
          [file]
        );

        console.log(`   ✓ ${file} - 実行完了`);
        executedCount++;
      } catch (error: any) {
        console.error(`   ✗ ${file} - 実行エラー:`, error.message);
        // CREATE TABLE IF NOT EXISTSを使用しているため、エラーがあっても続行
      }
    }

    console.log(`✅ マイグレーション完了: ${executedCount}個実行、${skippedCount}個スキップ`);
  } catch (error: any) {
    console.error('❌ マイグレーション実行エラー:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
