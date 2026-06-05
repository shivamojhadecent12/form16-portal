# Quick Reference - Employee Login Fix

## TL;DR (The Problem and Solution)

**Problem**: Employees get 500 error when loading documents after login
**Cause**: ObjectId vs String type mismatch in database queries
**Solution**: Convert ObjectId to String in JWT, String to ObjectId in DB queries

## What Changed (2 Files)

### 1. `backend/src/routes/auth-mongodb.js`
```javascript
// Convert IDs to strings in JWT tokens
employee._id.toString()  // Before: employee._id
admin._id.toString()     // Before: admin._id
```

### 2. `backend/src/routes/employees-mongodb.js`
```javascript
// Add import
import { ObjectId } from 'mongodb';

// Convert string IDs to ObjectId for DB queries
new ObjectId(req.params.id)  // When querying employees table
new ObjectId(id)             // For all getEmployeeById calls

// Keep as string for document queries
db.getDocumentsByEmployee(employeeId)  // Keep as string
```

## Type Conversion Rules

| Where | From | To | Why |
|-------|------|-----|-----|
| JWT Token | ObjectId | String | JSON serialization |
| URL Params | HTTP (String) | String | Native type |
| DB _id Query | String | ObjectId | MongoDB requirement |
| Document employee_id | String | String | Stored as string |

## Verification

```bash
# 1. Backend running?
curl http://localhost:5002/api/health
# Expected: {"status":"ok","message":"Server is running"}

# 2. Can login?
curl -X POST http://localhost:5002/api/auth/login/employee \
  -H "Content-Type: application/json" \
  -d '{"pan":"AAAAA0000A","name":"John Doe"}'
# Expected: { "token": "...", "user": { "id": "507f...", ... } }

# 3. Can see documents?
curl http://localhost:5002/api/employees/507f.../documents \
  -H "Authorization: Bearer TOKEN"
# Expected: [ { _id: "...", name: "...", ... } ]
```

## Files Modified

1. ✅ `backend/src/routes/auth-mongodb.js` - 4 changes
2. ✅ `backend/src/routes/employees-mongodb.js` - 9 changes + 1 import

## Testing in UI

1. Go to http://localhost:3001/
2. Select "Employee Login" tab
3. Enter PAN and Name
4. Click "Sign In"
5. Click on a document
6. Should load without 500 error ✅

## If It's Still Not Working

1. Check backend is running: `curl http://localhost:5002/api/health`
2. Check MongoDB is running: `mongosh form16_portal --eval "db.employees.countDocuments()"`
3. Check for employee data: Import a ZIP file first if empty
4. Check logs: `cat /tmp/backend.log`

## Documentation

- **Quick Fix**: EMPLOYEE_LOGIN_FIX.md
- **Technical Details**: EMPLOYEE_LOGIN_TECHNICAL_DEEP_DIVE.md
- **This File**: EMPLOYEE_LOGIN_QUICK_REFERENCE.md
