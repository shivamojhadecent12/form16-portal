import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client = null;
let db = null;

async function initConnection() {
  if (db) {
    return db;
  }

  const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_NAME || 'form16_portal';

  try {
    client = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db(dbName);

    console.log(`✅ Connected to MongoDB: ${dbName}`);

    // Verify connection
    await db.admin().ping();

    return db;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    throw error;
  }
}

// Get database instance
export async function getDb() {
  if (!db) {
    await initConnection();
  }
  return db;
}

// Get specific collection
export async function getCollection(collectionName) {
  const database = await getDb();
  return database.collection(collectionName);
}

// Close connection
export async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// Collections
export const Collections = {
  ADMINS: 'admins',
  EMPLOYEES: 'employees',
  EMPLOYEE_PROFILES: 'employee_profiles',
  DOCUMENTS: 'documents',
  DOCUMENT_METADATA: 'document_metadata',
  AI_ANALYSIS: 'ai_analysis',
  CHAT_HISTORY: 'chat_history',
  IMPORT_JOBS: 'import_jobs',
  IMPORT_JOB_LOGS: 'import_job_logs',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
};

export default { getDb, getCollection, closeConnection, Collections };
