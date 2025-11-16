import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

interface MigrationFile {
  filename: string;
  filepath: string;
}

async function runMigrations(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'facility_reservation';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database '${dbName}' created or already exists`);

    // Use the database
    await connection.query(`USE \`${dbName}\``);

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(filename => ({
        filename,
        filepath: path.join(migrationsDir, filename),
      }));

    console.log(`Found ${files.length} migration files`);

    // Run each migration
    for (const migration of files) {
      console.log(`\nRunning migration: ${migration.filename}`);
      const sql = fs.readFileSync(migration.filepath, 'utf8');

      try {
        await connection.query(sql);
        console.log(`✓ Successfully executed ${migration.filename}`);
      } catch (error: any) {
        console.error(`✗ Error executing ${migration.filename}:`, error.message);
        throw error;
      }
    }

    console.log('\n✓ All migrations completed successfully!');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

export default runMigrations;
