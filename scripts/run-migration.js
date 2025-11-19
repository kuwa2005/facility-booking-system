const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  let connection;
  try {
    // データベース接続を作成
    connection = await mysql.createConnection({
      host: process.env.DB_HOST === 'db' ? 'localhost' : process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('データベースに接続しました');

    // migrationsテーブルが存在しない場合は作成
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // migrationsディレクトリからすべてのSQLファイルを読み込む
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    console.log(`${sqlFiles.length}個のマイグレーションファイルが見つかりました`);

    for (const file of sqlFiles) {
      // 既に実行済みかチェック
      const [executed] = await connection.query(
        'SELECT * FROM migrations WHERE filename = ?',
        [file]
      );

      if (executed.length > 0) {
        console.log(`⊘ ${file} - スキップ（実行済み）`);
        continue;
      }

      console.log(`▶ ${file} を実行中...`);

      // SQLファイルを読み込んで実行
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');

      try {
        await connection.query(sql);

        // 実行済みとして記録
        await connection.query(
          'INSERT INTO migrations (filename) VALUES (?)',
          [file]
        );

        console.log(`✓ ${file} - 実行完了`);
      } catch (error) {
        console.error(`✗ ${file} - 実行エラー:`, error.message);
        // エラーが発生してもCREATE TABLE IF NOT EXISTSなので続行
      }
    }

    console.log('\n全てのマイグレーションが完了しました');

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('データベース接続を閉じました');
    }
  }
}

runMigrations();
