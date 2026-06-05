# MongoDB Migration Guide for Form 16 Portal

## Overview

This guide explains the conversion from MySQL to MongoDB for the entire Form 16 Portal project.

## Changes Made

### 1. **Dependencies**
- ✅ Removed: `mysql2` (^3.6.5)
- ✅ Added: `mongodb` (^6.3.0)

### 2. **Configuration Files**

#### New Files Created:
- `backend/src/config/mongodb.js` - MongoDB connection and configuration
- `backend/src/scripts/setup-mongodb.js` - Database initialization script
- `backend/src/scripts/seed-mongodb.js` - Admin user seeding script
- `backend/src/scripts/migrate-to-mongodb.js` - Data migration from MySQL
- `backend/src/services/db.js` - Database abstraction layer
- `backend/.env.mongodb` - MongoDB-specific environment variables

#### Files to Replace/Update:
- `backend/src/config/database.js` → Use MongoDB config instead
- `backend/package.json` → Updated dependencies and scripts

### 3. **Database Setup Instructions**

#### Step 1: Install MongoDB
```bash
# macOS (using Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### Step 2: Install New Dependencies
```bash
cd backend
npm install mongodb
npm uninstall mysql2
```

#### Step 3: Update Environment Variables
```bash
# Copy the new MongoDB config
cp .env.mongodb .env

# Edit .env with your MongoDB URI if not using default localhost
MONGODB_URI=mongodb://localhost:27017
MONGODB_NAME=form16_portal
```

#### Step 4: Initialize MongoDB Database
```bash
npm run db:setup
```

This will:
- Create all MongoDB collections
- Set up indexes for performance
- Insert default settings

#### Step 5: Seed Admin User
```bash
npm run db:seed
```

This will create a default admin user:
- Email: `admin@portal.gov.in`
- Password: `admin123`

⚠️ **IMPORTANT**: Change this password immediately in production!

#### Step 6: (Optional) Migrate Existing Data
If you have existing MySQL data:
```bash
npm run migrate:mongodb
```

Add to package.json scripts:
```json
"migrate:mongodb": "node src/scripts/migrate-to-mongodb.js"
```

### 4. **Collection Schema**

MongoDB collections are created with the following structure:

#### Admins
```javascript
{
  _id: "uuid-string",
  email: "admin@portal.gov.in",
  password_hash: "bcrypted-password",
  name: "System Administrator",
  created_at: Date,
  updated_at: Date
}
```

#### Employees
```javascript
{
  _id: "uuid-string",
  pan: "AAPPF9976K",
  name: "Employee Name",
  name_normalized: "employee name",
  department: "IT",
  designation: "Developer",
  employer_name: "Company Name",
  created_at: Date,
  updated_at: Date
}
```

#### Documents
```javascript
{
  _id: "uuid-string",
  employee_id: "uuid-string",
  document_type: "form16",  // enum: form16, salary_slip, appointment_letter, promotion_letter
  financial_year: "2025-26",
  file_path: "/path/to/file.pdf",
  file_name: "filename.pdf",
  file_size: 123456,
  uploaded_by: "admin-uuid",
  uploaded_at: Date,
  review_status: "approved",  // enum: pending, approved, rejected
  reviewed_by: "admin-uuid",
  reviewed_at: Date,
  created_at: Date,
  updated_at: Date
}
```

#### Document Metadata
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
    financial_year: "2025-26",
    // ... other extracted fields
  },
  confidence_score: 95.5,
  extraction_errors: [],
  created_at: Date,
  updated_at: Date
}
```

### 5. **Route Migration**

All route files need to be updated to use the new database layer:

**Before (MySQL):**
```javascript
const [results] = await pool.query('SELECT * FROM documents WHERE employee_id = ?', [employeeId]);
```

**After (MongoDB):**
```javascript
import * as db from '../services/db.js';

const results = await db.getDocumentsByEmployee(employeeId);
```

#### Routes to Update:
- `routes/auth.js` - Login/verification
- `routes/employees.js` - Employee management
- `routes/documents.js` - Document operations
- `routes/import.js` - Import/upload functionality
- `routes/dashboard.js` - Statistics and analytics
- `routes/chat.js` - Chat history (optional - disabled)

### 6. **Using the Database Abstraction Layer**

The `db.js` service provides simple functions for all database operations:

```javascript
import * as db from '../services/db.js';

// Get admin
const admin = await db.getAdmin('admin@portal.gov.in');

// Get employee
const employee = await db.getEmployee('AAPPF9976K');

// Create document
await db.createDocument({
  _id: generateUUID(),
  employee_id: 'emp-uuid',
  document_type: 'form16',
  financial_year: '2025-26',
  file_path: '/path/to/file.pdf',
  file_name: 'filename.pdf',
  // ...
});

// Update document
await db.updateDocument(docId, {
  review_status: 'approved',
  reviewed_at: new Date(),
});

// Check duplicate
const existing = await db.checkDuplicateDocument(empId, 'form16', '2025-26');
```

### 7. **Indexes**

MongoDB collections have the following indexes for performance:

- `admins.email` - Unique
- `employees.pan` - Unique
- `employees.name_normalized`
- `documents.employee_id`
- `documents.document_type`
- `documents.financial_year`
- `documents.review_status`
- `documents.(employee_id, document_type, financial_year)` - Composite
- `import_jobs.status`
- `audit_logs.user_id`
- `audit_logs.created_at`

### 8. **Important Differences from MySQL**

| Aspect | MySQL | MongoDB |
|--------|-------|---------|
| Primary Key | `id` | `_id` |
| Null Values | NULL | null or undefined |
| Queries | SQL strings | JavaScript objects |
| Dates | TIMESTAMP | Date objects |
| JSON | JSON column | Native objects |
| ENUM | Column constraint | String with validation |
| Auto-increment | AUTO_INCREMENT | Manual UUID |
| Foreign Keys | FK constraints | Document references (manual) |
| Transactions | Built-in (InnoDB) | Need session/transaction API |
| JOINs | SQL JOIN | $lookup aggregation |

### 9. **Migration Checklist**

- [ ] Install MongoDB and verify it's running
- [ ] Update `package.json` (remove mysql2, add mongodb)
- [ ] Copy `.env.mongodb` to `.env`
- [ ] Run `npm install` in backend
- [ ] Run `npm run db:setup`
- [ ] Run `npm run db:seed`
- [ ] Update `routes/auth.js` to use new db layer
- [ ] Update `routes/employees.js`
- [ ] Update `routes/documents.js`
- [ ] Update `routes/import.js` (largest file - prioritize)
- [ ] Update `routes/dashboard.js`
- [ ] Update `middleware/auth.js` if needed
- [ ] Update `middleware/audit.js` if needed
- [ ] Test all API endpoints
- [ ] Verify dashboard metrics
- [ ] Test file upload
- [ ] Test document retrieval
- [ ] (Optional) Migrate existing data with `npm run migrate:mongodb`

### 10. **Testing the Setup**

```bash
# Start MongoDB (if not running)
brew services start mongodb-community

# Install dependencies
npm install

# Setup database
npm run db:setup

# Seed admin user
npm run db:seed

# Start server
npm start

# Test health endpoint
curl http://localhost:5002/api/health

# Test login
curl -X POST http://localhost:5002/api/auth/login/admin \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@portal.gov.in","password":"admin123"}'
```

### 11. **Troubleshooting**

**MongoDB Connection Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
Solution: Start MongoDB service
```bash
brew services start mongodb-community
# or
docker start mongodb
```

**Collection Already Exists:**
```
MongoError: namespace already exists with different options
```
Solution: Drop the database and recreate
```bash
npm run db:setup  # Will handle existing collections gracefully
```

**Duplicate Key Error:**
```
MongoError: E11000 duplicate key error
```
Solution: Check your indexes and data. Ensure email/pan are unique.

### 12. **Performance Considerations**

MongoDB offers several advantages:
- **Schema Flexibility**: Add new fields without migrations
- **Nested Data**: Store related data in single document
- **Scalability**: Easier horizontal scaling
- **Developer Experience**: Objects map directly to JavaScript

Considerations:
- **Transactions**: Limited in free MongoDB Atlas; use careful operation ordering
- **Joins**: Use `$lookup` for related data (similar to SQL JOINs)
- **Indexing**: Still critical for performance (already configured)

## Summary

The conversion maintains all existing functionality while leveraging MongoDB's flexibility. The database abstraction layer (`db.js`) provides a clean interface that makes it easy to update routes without worrying about MongoDB-specific syntax.

**Next Steps:**
1. Follow the setup instructions above
2. Update each route file systematically
3. Test thoroughly before deployment
4. Optionally migrate existing data

For detailed route-by-route migration instructions, refer to individual route files.
