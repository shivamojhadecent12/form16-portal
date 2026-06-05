import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.mongodb' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'form16_portal';

async function clearDatabase() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Found ${collections.length} collections:\n`);

    let totalDeleted = 0;

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = db.collection(collectionName);
      
      const count = await collection.countDocuments();
      
      if (count > 0) {
        const result = await collection.deleteMany({});
        console.log(`  🗑️  ${collectionName}: Deleted ${result.deletedCount} documents`);
        totalDeleted += result.deletedCount;
      } else {
        console.log(`  ✓ ${collectionName}: Already empty`);
      }
    }

    console.log(`\n✅ CLEANUP COMPLETE`);
    console.log(`📊 Total documents deleted: ${totalDeleted}\n`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

clearDatabase();
