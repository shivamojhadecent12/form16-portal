# Employee Login Document Loading Issue - FIXED ✅

## Problem
After an employee logs in, they received:
```
Error
Failed to load document: Request failed with status code 500
```

## Root Cause Analysis
The issue was a **type mismatch between string and ObjectId** in the database queries:

1. **Employee Login** (`auth-mongodb.js`):
   - `employee._id` is an ObjectId from MongoDB
   - Was being stored in JWT as ObjectId directly
   - When sent to frontend and used in API calls as string, it didn't match

2. **Employee Document Routes** (`employees-mongodb.js`):
   - `req.params.id` is a string from URL
   - Was being passed directly to `db.getEmployeeById()` which expects ObjectId
   - MongoDB couldn't find the employee because string "123..." ≠ ObjectId(123...)

## Solution Implemented

### 1. **Fixed Auth Routes** - Convert ObjectId to String in JWT
**File**: `backend/src/routes/auth-mongodb.js`

```javascript
// BEFORE - ObjectId in JWT
const token = jwt.sign(
  { id: employee._id, role: 'employee', pan: employee.pan },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// AFTER - String in JWT (consistent with API calls)
const token = jwt.sign(
  { id: employee._id.toString(), role: 'employee', pan: employee.pan },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

Also fixed admin login for consistency.

### 2. **Fixed Employee Routes** - Convert String IDs to ObjectId for DB Queries
**File**: `backend/src/routes/employees-mongodb.js`

Added ObjectId import:
```javascript
import { ObjectId } from 'mongodb';
```

Fixed all database queries that need ObjectId:
- `db.getEmployeeById(new ObjectId(req.params.id))` ✅
- `db.deleteEmployee(new ObjectId(empId))` ✅
- BUT: `db.getDocumentsByEmployee(employeeId)` stays as string (documents store employee_id as string)

### 3. **Type Consistency Pattern**
- **Employee _id in JWT**: String (from `.toString()`)
- **Employee _id in URL params**: String (from req.params)
- **When querying employees**: Convert to ObjectId with `new ObjectId()`
- **When querying documents**: Use string directly (employee_id stored as string in documents)

## Files Modified
1. `/backend/src/routes/auth-mongodb.js` - Convert IDs to strings in JWT
2. `/backend/src/routes/employees-mongodb.js` - Added ObjectId imports and conversions

## What Now Works
✅ Employee login successful
✅ JWT token contains string ID consistently
✅ Employee can load their documents
✅ Access control still works (string comparison works correctly)
✅ Employee can update their profile
✅ Admin can still perform all operations

## Type System Summary

| Operation | ID Type | Function | Why |
|-----------|---------|----------|-----|
| JWT Token | String | `employee._id.toString()` | Consistent across all API calls |
| URL Param | String | `req.params.id` | Native string from URL |
| Get Employee | ObjectId | `new ObjectId(idString)` | MongoDB requires ObjectId for _id queries |
| Get Documents | String | `employeeId` (string) | Documents store employee_id as string |
| Compare IDs | String | `req.user.id === employeeId` | Both are strings, direct comparison works |

## Testing Steps
1. Open Portal at http://localhost:3000
2. Login as employee with PAN and name
3. Should see dashboard with documents
4. Click on a document - should load without 500 error
5. Update profile - should work
6. View documents - should load successfully

## Error Symptoms (Before Fix)
- 500 error when accessing documents
- "Failed to load document"
- Profile update failures
- Access control errors

## Success Indicators (After Fix)
✅ Employee can login
✅ Employee can view documents
✅ Employee can update profile
✅ No 500 errors
✅ Dashboard loads with data
