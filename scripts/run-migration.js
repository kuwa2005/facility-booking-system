const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
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

    // user_favorite_roomsテーブルが存在するか確認
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'user_favorite_rooms'"
    );

    if (tables.length > 0) {
      console.log('user_favorite_roomsテーブルは既に存在しています');
      return;
    }

    console.log('user_favorite_roomsテーブルを作成します...');

    // テーブルを作成
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_favorite_rooms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        room_id INT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_room (user_id, room_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ user_favorite_roomsテーブルを作成しました');

    // テーブルが正しく作成されたか確認
    const [result] = await connection.query(
      "SHOW TABLES LIKE 'user_favorite_rooms'"
    );

    if (result.length > 0) {
      console.log('✓ テーブルの作成を確認しました');
    } else {
      console.error('✗ テーブルの作成に失敗しました');
    }

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('データベース接続を閉じました');
    }
  }
}

runMigration();
