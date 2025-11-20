const bcrypt = require('bcrypt');

/**
 * パスワードのbcryptハッシュを生成するスクリプト
 * 使用方法: node scripts/generate-password-hash.js <password>
 */

async function generateHash() {
    const password = process.argv[2] || 'admin123';
    const saltRounds = 10;

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('パスワード:', password);
        console.log('ハッシュ:', hash);
        console.log('\nSQLの例:');
        console.log(`password_hash = '${hash}'`);
    } catch (error) {
        console.error('エラー:', error);
        process.exit(1);
    }
}

generateHash();
