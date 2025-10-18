import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ Database connected successfully');

    // Check if users table exists and has data
    const [users] = await connection.execute('SELECT * FROM users');
    console.log('📋 Users in database:', users);

    // Show passwords (for debugging)
    users.forEach(user => {
      console.log(`👤 ${user.email}: ${user.password} (role: ${user.role})`);
    });

    await connection.end();
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

testDatabase();