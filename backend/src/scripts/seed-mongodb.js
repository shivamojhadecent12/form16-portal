import { getCollection, Collections, closeConnection } from '../config/mongodb.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function generateUUID() {
  return crypto.randomUUID();
}

async function seedDatabase() {
  try {
    const adminsCollection = await getCollection(Collections.ADMINS);

    console.log('👤 Seeding admin user...\n');

    const existingAdmin = await adminsCollection.findOne({ email: 'admin@portal.gov.in' });

    if (existingAdmin) {
      console.log('⏭️  Admin user already exists');
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      const admin = {
        _id: generateUUID(),
        email: 'admin@portal.gov.in',
        password_hash: hashedPassword,
        name: 'System Administrator',
        created_at: new Date(),
        updated_at: new Date(),
      };

      await adminsCollection.insertOne(admin);

      console.log('✅ Admin user created');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: admin123`);
      console.log(`   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION\n`);
    }

    console.log('🎉 Database seeding complete!\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

seedDatabase();
