import mysql from 'mysql2/promise';
import { getDb, getCollection, Collections, closeConnection } from '../config/mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateData() {
  let mysqlConnection;
  let mongoDb;

  try {
    // Connect to MySQL (old database)
    console.log('🔄 Connecting to MySQL for migration...\n');
    mysqlConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'form16_portal',
    });

    // Connect to MongoDB (new database)
    mongoDb = await getDb();

    console.log('✅ Connected to both databases\n');

    // Define migration tasks
    const tables = [
      'admins',
      'employees',
      'employee_profiles',
      'documents',
      'document_metadata',
      'ai_analysis',
      'chat_history',
      'import_jobs',
      'import_job_logs',
      'audit_logs',
      'settings',
    ];

    for (const table of tables) {
      console.log(`📤 Migrating ${table}...`);

      try {
        // Get all data from MySQL
        const [rows] = await mysqlConnection.query(`SELECT * FROM ${table}`);

        if (rows.length === 0) {
          console.log(`   ⏭️  No data to migrate`);
          continue;
        }

        // Convert rows for MongoDB
        const documents = rows.map((row) => {
          const doc = { ...row };
          // Rename 'id' to '_id' for MongoDB
          if (doc.id) {
            doc._id = doc.id;
            delete doc.id;
          }
          // Convert date strings to Date objects
          if (doc.created_at && typeof doc.created_at === 'string') {
            doc.created_at = new Date(doc.created_at);
          }
          if (doc.updated_at && typeof doc.updated_at === 'string') {
            doc.updated_at = new Date(doc.updated_at);
          }
          if (doc.uploaded_at && typeof doc.uploaded_at === 'string') {
            doc.uploaded_at = new Date(doc.uploaded_at);
          }
          if (doc.reviewed_at && typeof doc.reviewed_at === 'string') {
            doc.reviewed_at = new Date(doc.reviewed_at);
          }
          if (doc.started_at && typeof doc.started_at === 'string') {
            doc.started_at = new Date(doc.started_at);
          }
          if (doc.completed_at && typeof doc.completed_at === 'string') {
            doc.completed_at = new Date(doc.completed_at);
          }
          if (doc.analysis_date && typeof doc.analysis_date === 'string') {
            doc.analysis_date = new Date(doc.analysis_date);
          }
          // Parse JSON fields
          if (doc.parsed_json && typeof doc.parsed_json === 'string') {
            try {
              doc.parsed_json = JSON.parse(doc.parsed_json);
            } catch (e) {
              console.warn(`   ⚠️  Failed to parse JSON in ${table}`);
            }
          }
          if (doc.salary_summary && typeof doc.salary_summary === 'string') {
            try {
              doc.salary_summary = JSON.parse(doc.salary_summary);
            } catch (e) {}
          }
          if (doc.extraction_errors && typeof doc.extraction_errors === 'string') {
            try {
              doc.extraction_errors = JSON.parse(doc.extraction_errors);
            } catch (e) {}
          }
          if (doc.context_used && typeof doc.context_used === 'string') {
            try {
              doc.context_used = JSON.parse(doc.context_used);
            } catch (e) {}
          }
          if (doc.details && typeof doc.details === 'string') {
            try {
              doc.details = JSON.parse(doc.details);
            } catch (e) {}
          }
          return doc;
        });

        // Insert into MongoDB
        const collection = mongoDb.collection(getMongoCollectionName(table));
        const result = await collection.insertMany(documents, { ordered: false });

        console.log(`   ✅ Migrated ${result.insertedCount} records`);
      } catch (error) {
        console.error(`   ❌ Error migrating ${table}:`, error.message);
      }
    }

    console.log('\n🎉 Migration complete!\n');

  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    process.exit(1);
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await closeConnection();
  }
}

function getMongoCollectionName(tableName) {
  const mapping = {
    admins: Collections.ADMINS,
    employees: Collections.EMPLOYEES,
    employee_profiles: Collections.EMPLOYEE_PROFILES,
    documents: Collections.DOCUMENTS,
    document_metadata: Collections.DOCUMENT_METADATA,
    ai_analysis: Collections.AI_ANALYSIS,
    chat_history: Collections.CHAT_HISTORY,
    import_jobs: Collections.IMPORT_JOBS,
    import_job_logs: Collections.IMPORT_JOB_LOGS,
    audit_logs: Collections.AUDIT_LOGS,
    settings: Collections.SETTINGS,
  };
  return mapping[tableName] || tableName;
}

migrateData();
