import { getDb, getCollection, Collections, closeConnection } from '../config/mongodb.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

function generateUUID() {
  return crypto.randomUUID();
}

async function setupDatabase() {
  try {
    const db = await getDb();

    console.log('📦 Setting up MongoDB collections...\n');

    // Create collections without validation (more flexible)
    const collections = [
      {
        name: Collections.ADMINS,
        options: {},
      },
      {
        name: Collections.EMPLOYEES,
        options: {},
      },
      {
        name: Collections.EMPLOYEE_PROFILES,
        options: {},
      },
      {
        name: Collections.DOCUMENTS,
        options: {},
      },
      {
        name: Collections.DOCUMENT_METADATA,
        options: {},
      },
      {
        name: Collections.AI_ANALYSIS,
        options: {},
      },
      {
        name: Collections.CHAT_HISTORY,
        options: {},
      },
      {
        name: Collections.IMPORT_JOBS,
        options: {},
      },
      {
        name: Collections.IMPORT_JOB_LOGS,
        options: {},
      },
      {
        name: Collections.AUDIT_LOGS,
        options: {},
      },
      {
        name: Collections.SETTINGS,
        options: {},
      },
    ];

    // Create collections
    for (const collConfig of collections) {
      try {
        await db.createCollection(collConfig.name, collConfig.options);
        console.log(`✅ Created collection: ${collConfig.name}`);
      } catch (error) {
        if (error.code === 48) {
          // Collection already exists
          console.log(`⏭️  Collection already exists: ${collConfig.name}`);
        } else {
          throw error;
        }
      }
    }

    // Create indexes
    console.log('\n📑 Creating indexes...\n');

    const indexConfigs = [
      {
        collection: Collections.ADMINS,
        indexes: [{ email: 1 }],
      },
      {
        collection: Collections.EMPLOYEES,
        indexes: [
          { pan: 1 },
          { name_normalized: 1 },
        ],
      },
      {
        collection: Collections.EMPLOYEE_PROFILES,
        indexes: [
          { employee_id: 1 },
        ],
      },
      {
        collection: Collections.DOCUMENTS,
        indexes: [
          { employee_id: 1 },
          { document_type: 1 },
          { financial_year: 1 },
          { review_status: 1 },
          { employee_id: 1, document_type: 1, financial_year: 1 },
        ],
      },
      {
        collection: Collections.DOCUMENT_METADATA,
        indexes: [
          { document_id: 1 },
        ],
      },
      {
        collection: Collections.AI_ANALYSIS,
        indexes: [
          { document_id: 1 },
        ],
      },
      {
        collection: Collections.CHAT_HISTORY,
        indexes: [
          { employee_id: 1 },
        ],
      },
      {
        collection: Collections.IMPORT_JOBS,
        indexes: [
          { status: 1 },
        ],
      },
      {
        collection: Collections.IMPORT_JOB_LOGS,
        indexes: [
          { import_job_id: 1 },
        ],
      },
      {
        collection: Collections.AUDIT_LOGS,
        indexes: [
          { user_id: 1 },
          { created_at: 1 },
        ],
      },
    ];

    for (const indexConfig of indexConfigs) {
      const collection = db.collection(indexConfig.collection);
      for (const index of indexConfig.indexes) {
        try {
          await collection.createIndex(index, { unique: Object.keys(index)[0] === 'email' || Object.keys(index)[0] === 'pan' });
          console.log(`✅ Created index on ${indexConfig.collection}: ${JSON.stringify(index)}`);
        } catch (error) {
          if (error.code === 85) {
            // Index already exists
            console.log(`⏭️  Index already exists on ${indexConfig.collection}`);
          } else {
            console.warn(`⚠️  Could not create index: ${error.message}`);
          }
        }
      }
    }

    // Insert default settings
    console.log('\n⚙️  Inserting default settings...\n');

    const settingsCollection = db.collection(Collections.SETTINGS);
    const settings = [
      {
        _id: generateUUID(),
        key: 'openrouter_api_key',
        value: '',
        description: 'OpenRouter API Key for AI analysis',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: generateUUID(),
        key: 'max_file_size_mb',
        value: 50,
        description: 'Maximum file size for uploads in MB',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: generateUUID(),
        key: 'allowed_document_types',
        value: ['application/pdf'],
        description: 'Allowed document MIME types',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: generateUUID(),
        key: 'enable_ai_analysis',
        value: true,
        description: 'Enable AI analysis for documents',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const setting of settings) {
      const existing = await settingsCollection.findOne({ key: setting.key });
      if (!existing) {
        await settingsCollection.insertOne(setting);
        console.log(`✅ Inserted setting: ${setting.key}`);
      } else {
        console.log(`⏭️  Setting already exists: ${setting.key}`);
      }
    }

    console.log('\n🎉 MongoDB setup complete!');
    console.log('Next step: Run "npm run db:seed" to create default admin user\n');

  } catch (error) {
    console.error('❌ Error setting up MongoDB:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

setupDatabase();
