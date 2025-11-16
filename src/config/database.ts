import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// データベース設定
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'facility_reservation',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00', // 日付をUTCとして保存
  dateStrings: false,
};

// コネクションプールの作成
export const pool = mysql.createPool(dbConfig);

/**
 * データベース接続のテスト
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✓ データベース接続成功');
    return true;
  } catch (error: any) {
    console.error('✗ データベース接続失敗:', error.message);
    return false;
  }
}

/**
 * プール内のすべての接続を閉じる
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('データベースプールをクローズしました');
}

export default pool;
