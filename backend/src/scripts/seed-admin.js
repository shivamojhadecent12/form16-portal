import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { generateUUID } from '../utils/uuid.js';

async function seedAdmin() {
  try {
    console.log('👤 Creating default admin user...');

    const adminId = generateUUID();
    const email = 'admin@portal.gov.in';
    const password = 'admin123';
    const name = 'System Administrator';

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert admin
    await pool.query(
      'INSERT IGNORE INTO admins (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      [adminId, email, passwordHash, name]
    );

    console.log('✅ Default admin created');
    console.log('');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('');
    console.log('⚠️  CHANGE THIS PASSWORD IN PRODUCTION!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
