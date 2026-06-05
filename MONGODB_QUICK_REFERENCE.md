# MongoDB Conversion - Quick Reference Guide

## 🚀 Quick Start

### 1. Start MongoDB
```bash
# macOS with Homebrew
brew services start mongodb-community

# OR Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.mongodb .env
npm run db:setup
npm run db:seed
npm start
```

### 3. Test Connection
```bash
curl http://localhost:5002/api/health
# Response: {"status":"ok","message":"Server is running"}
```

## 📚 Database Layer Reference

All database operations are in `backend/src/services/db.js`. Import and use:

```javascript
import * as db from '../services/db.js';
```

### Common Operations

**Admins**
```javascript
const admin = await db.getAdmin('admin@portal.gov.in');
const admin = await db.getAdminById(adminId);
await db.createAdmin(adminData);
```

**Employees**
```javascript
const emp = await db.getEmployee('AAPPF9976K');  // By PAN
const emp = await db.getEmployeeById(empId);
const employees = await db.getAllEmployees(0, 50);  // skip, limit
await db.createEmployee(empData);
await db.updateEmployee(empId, { department: 'IT' });
await db.deleteEmployee(empId);
```

**Documents**
```javascript
const doc = await db.getDocument(docId);
const docs = await db.getDocumentsByEmployee(empId);
const docs = await db.getDocumentsByYear(empId, '2025-26');
const docs = await db.getAllDocuments(0, 50, { review_status: 'approved' });
await db.createDocument(docData);
await db.updateDocument(docId, { review_status: 'approved' });
await db.deleteDocument(docId);

// Check for duplicates
const existing = await db.checkDuplicateDocument(empId, 'form16', '2025-26');
```

**Document Metadata**
```javascript
const metadata = await db.getDocumentMetadata(docId);
await db.createDocumentMetadata(metadataData);
await db.updateDocumentMetadata(docId, { parsed_json: {...} });
```

**Import Jobs**
```javascript
const job = await db.getImportJob(jobId);
const jobs = await db.getImportJobs(0, 50);
await db.createImportJob(jobData);
await db.updateImportJob(jobId, { status: 'completed' });

const logs = await db.getImportJobLogs(jobId);
await db.createImportJobLog(logData);
```

**Audit Logs**
```javascript
await db.createAuditLog({
  _id: generateUUID(),
  user_id: userId,
  user_role: 'admin',
  action: 'delete',
  resource_type: 'document',
  resource_id: docId,
  created_at: new Date(),
});
```

**Settings**
```javascript
const setting = await db.getSetting('max_file_size_mb');
const allSettings = await db.getAllSettings();
await db.updateSetting('max_file_size_mb', 100);
```

## 🔄 Converting Routes: Step-by-Step

### Before: MySQL Version
```javascript
import pool from '../config/database.js';

router.get('/employees', async (req, res) => {
  const [employees] = await pool.query('SELECT * FROM employees');
  res.json(employees);
});
```

### After: MongoDB Version
```javascript
import * as db from '../services/db.js';

router.get('/employees', async (req, res) => {
  const employees = await db.getAllEmployees();
  res.json(employees);
});
```

## 📝 Document Structures (MongoDB)

### Admin
```javascript
{
  _id: "uuid-string",
  email: "admin@portal.gov.in",
  password_hash: "bcrypted...",
  name: "System Administrator",
  created_at: Date,
  updated_at: Date
}
```

### Employee
```javascript
{
  _id: "uuid-string",
  pan: "AAPPF9976K",
  name: "Employee Name",
  name_normalized: "employee name",
  department: "IT",
  designation: "Developer",
  employer_name: "Company",
  created_at: Date,
  updated_at: Date
}
```

### Document
```javascript
{
  _id: "uuid-string",
  employee_id: "uuid-string",
  document_type: "form16",  // form16, salary_slip, appointment_letter, promotion_letter
  financial_year: "2025-26",
  file_path: "/path/to/file.pdf",
  file_name: "filename.pdf",
  file_size: 123456,
  uploaded_by: "admin-uuid",
  uploaded_at: Date,
  review_status: "approved",  // pending, approved, rejected
  reviewed_by: "admin-uuid",
  reviewed_at: Date,
  created_at: Date,
  updated_at: Date
}
```

### Document Metadata
```javascript
{
  _id: "uuid-string",
  document_id: "uuid-string",
  raw_text: "extracted-text-from-pdf",
  parsed_json: {
    gross_salary: 254435,
    net_salary: 179435,
    tds: 0,
    tax_paid: 0,
    financial_year: "2025-26"
  },
  confidence_score: 95.5,
  extraction_errors: [],
  created_at: Date,
  updated_at: Date
}
```

### Import Job
```javascript
{
  _id: "uuid-string",
  document_type: "form16",
  file_name: "upload.zip",
  file_path: "/path/to/upload.zip",
  total_files: 4,
  processed_files: 4,
  successful_files: 4,
  failed_files: 0,
  status: "completed",  // pending, processing, completed, failed, skipped
  started_at: Date,
  completed_at: Date,
  uploaded_by: "admin-uuid",
  created_at: Date,
  updated_at: Date
}
```

## 🔍 Common Queries/Aggregations

### Get Dashboard Stats
```javascript
const stats = await db.getDashboardStats();
// Returns: { total_documents, total_files_size }
```

### Get Documents by Year and Type
```javascript
const yearData = await db.getDocumentsByYearAndType(empId);
// Returns array with year/type grouping
```

### Aggregation Example
```javascript
const collection = await getCollection(Collections.DOCUMENTS);
const results = await collection.aggregate([
  { $match: { employee_id: empId } },
  { $group: {
      _id: '$financial_year',
      count: { $sum: 1 },
      documents: { $push: '$$ROOT' }
    }
  },
  { $sort: { _id: -1 } }
]).toArray();
```

## ⚠️ Important Differences

### ID Field
- **MySQL**: Uses `id` column
- **MongoDB**: Uses `_id` field
- **Action**: When returning from DB, `_id` is used; convert if needed

### Null Values
- **MySQL**: Uses SQL NULL
- **MongoDB**: Uses JavaScript null or omit the field

### Dates
- **MySQL**: TIMESTAMP strings
- **MongoDB**: JavaScript Date objects
- **Action**: Automatic in db layer; already handled

### Unique Constraints
- **MySQL**: UNIQUE keyword
- **MongoDB**: createIndex with unique option
- **Action**: Already set up in setup script

### Foreign Keys
- **MySQL**: FK constraints enforced
- **MongoDB**: No enforcement; check manually
- **Action**: db layer handles it; verify in logic

## 🧪 Testing

### Test Admin Login
```bash
curl -X POST http://localhost:5002/api/auth/login/admin \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@portal.gov.in","password":"admin123"}'
```

### Test Employee Login
```bash
curl -X POST http://localhost:5002/api/auth/login/employee \
  -H 'Content-Type: application/json' \
  -d '{"pan":"AAPPF9976K","name":"Employee Name"}'
```

### Test Get Employees
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5002/api/employees
```

## 🐛 Debugging Tips

### Check MongoDB Connection
```bash
# In Node.js
node -e "require('mongodb').MongoClient.connect('mongodb://localhost:27017').then(c => console.log('Connected')).catch(e => console.error(e))"
```

### View MongoDB Data (CLI)
```bash
mongosh  # or mongo for older versions
use form16_portal
db.admins.find()
db.employees.find()
db.documents.find()
```

### Enable MongoDB Logging
```javascript
// In your code
const client = new MongoClient(mongoUrl, {
  loggerLevel: 'debug'  // debug, info, warn, error
});
```

## 📋 File Mappings

### Configuration
- Old: `backend/src/config/database.js` (MySQL)
- New: `backend/src/config/mongodb.js` (MongoDB)

### Routes
- Old: `backend/src/routes/auth.js` (MySQL)
- New: `backend/src/routes/auth-mongodb.js` (MongoDB)
- Old: `backend/src/routes/employees.js` (MySQL)
- New: `backend/src/routes/employees-mongodb.js` (MongoDB)

### Scripts
- Old: `backend/src/scripts/setup-database.js` (MySQL)
- New: `backend/src/scripts/setup-mongodb.js` (MongoDB)
- Old: `backend/src/scripts/seed-admin.js` (MySQL)
- New: `backend/src/scripts/seed-mongodb.js` (MongoDB)
- New: `backend/src/scripts/migrate-to-mongodb.js` (Data migration)

## 🎯 Conversion Workflow

For each route file:

1. **Identify all pool.query() calls**
2. **Map to db.* functions**
3. **Update SQL strings to JavaScript objects**
4. **Test with Postman/curl**
5. **Verify data in MongoDB**
6. **Check error handling**
7. **Move to production**

Example:
```javascript
// ❌ Before
const [users] = await pool.query('SELECT * FROM employees WHERE pan = ?', [pan]);

// ✅ After  
const user = await db.getEmployee(pan);
```

## 🚨 Critical Routes (Convert First)

1. **import.js** - File uploads (most complex)
2. **documents.js** - Document retrieval
3. **dashboard.js** - Stats and aggregations

These handle the core functionality. Get them working first!

---

**Keep this guide handy while converting routes!**
