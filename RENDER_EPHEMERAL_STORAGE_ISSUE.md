# ⚠️ CRITICAL: Render Ephemeral Filesystem Problem & Solutions

**Date**: June 5, 2026  
**Issue**: Files stored in `/uploads/` will be DELETED when Render restarts or redeploys  
**Severity**: 🔴 CRITICAL

---

## 🚨 The Problem on Render

### What Happens

```
Local Development (Works ✅):
  Files: /backend/uploads/ (persistent)
  Database: MongoDB (persistent)
  Result: Everything works!

Render Deployment (BROKEN ❌):
  Files: /backend/uploads/ (EPHEMERAL - temporary)
  Database: MongoDB (persistent)
  
  On redeploy or restart:
    ├─ New server spins up
    ├─ /uploads/ folder: EMPTY
    ├─ Files: GONE FOREVER ❌
    ├─ MongoDB: Still has metadata
    ├─ But file_path points to: MISSING FILES
    └─ Users get: 404 errors ❌
```

### Timeline of Disaster

```
Day 1: Deploy to Render
  ✅ Upload 1000 PDFs
  ✅ Files saved: /uploads/
  ✅ Metadata in MongoDB
  ✅ Everything works

Day 8: Render restarts server (free tier)
  ❌ New filesystem created
  ❌ /uploads/ is EMPTY
  ❌ Old files are GONE
  ⚠️  MongoDB still has references to deleted files
  ❌ Users can't download anymore!

Day 15: You redeploy code update
  ❌ /uploads/ wiped again
  ❌ All files lost
  ❌ Have to re-import everything
```

---

## 🛠️ Solutions

### Solution 1: AWS S3 (RECOMMENDED) ⭐

**Best for production**

#### Setup Steps

1. **Create AWS Account**
   - Go: https://aws.amazon.com/
   - Sign up (free tier available)
   - Verify email

2. **Create S3 Bucket**
   ```
   Console → S3 → Create Bucket
   - Name: form16-portal-files
   - Region: closest to you
   - Block public access: ON
   - Create bucket
   ```

3. **Create IAM User** (security)
   ```
   IAM → Users → Create user
   - Name: form16-app
   - Programmatic access: ON
   - Permissions: AmazonS3FullAccess
   - Get Access Key ID + Secret
   - SAVE THESE! (never share)
   ```

4. **Update Backend Code**
   ```bash
   # Install AWS SDK
   cd backend
   npm install aws-sdk
   ```

5. **Create Upload Handler** (`backend/src/utils/s3.js`)
   ```javascript
   import AWS from 'aws-sdk';
   
   const s3 = new AWS.S3({
     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
     region: process.env.AWS_REGION
   });
   
   export async function uploadToS3(filePath, bucket, key) {
     const fileContent = await fs.readFile(filePath);
     const params = {
       Bucket: bucket,
       Key: key,
       Body: fileContent,
       ContentType: 'application/pdf'
     };
     return await s3.upload(params).promise();
   }
   
   export async function downloadFromS3(bucket, key) {
     const params = { Bucket: bucket, Key: key };
     return await s3.getObject(params).promise();
   }
   ```

6. **Update Document Model** (`backend/src/services/db.js`)
   ```javascript
   // OLD:
   file_path: "uploads/documents/PAN/2024/form16_partA/file.pdf"
   
   // NEW:
   s3_key: "documents/PAN/2024/form16_partA/file.pdf"
   s3_bucket: "form16-portal-files"
   file_url: "https://form16-portal-files.s3.amazonaws.com/..."
   ```

7. **Update Download Endpoint**
   ```javascript
   // OLD:
   const fileStream = fs.createReadStream(filePath);
   
   // NEW:
   const data = await downloadFromS3(doc.s3_bucket, doc.s3_key);
   res.setHeader('Content-Type', 'application/pdf');
   res.send(data.Body);
   ```

8. **Add Environment Variables** (Render)
   ```
   AWS_ACCESS_KEY_ID = your-key-id
   AWS_SECRET_ACCESS_KEY = your-secret-key
   AWS_REGION = us-east-1
   S3_BUCKET = form16-portal-files
   ```

9. **Cost**
   ```
   Free tier (first 12 months):
   - 5 GB storage: FREE
   - 20,000 GET: FREE
   - 2,000 PUT: FREE
   
   After free tier:
   - Storage: $0.023 per GB/month
   - 6 GB files: ~$0.14/month
   ```

---

### Solution 2: Google Cloud Storage

**Good alternative to AWS**

```
Steps:
1. Create Google Cloud account
2. Create Storage bucket
3. Create service account
4. Download JSON key
5. Install: npm install @google-cloud/storage
6. Similar code changes as S3
7. Cost: Similar to AWS (~$0.02/GB)
```

---

### Solution 3: MongoDB GridFS

**Store files IN MongoDB** (not recommended, but possible)

```javascript
// Pros:
  ✅ No extra service
  ✅ Everything in one place
  
// Cons:
  ❌ Slow (binary files in DB)
  ❌ Limited to 512 MB (free tier)
  ❌ More expensive as you scale
```

**NOT RECOMMENDED for production**

---

### Solution 4: Keep on Disk + Cron Job

**Backup approach**

```
1. Keep files in /uploads/
2. Every day: backup to S3
3. On restart: restore from S3
4. Cron job: gsutil cp -r /uploads/ gs://bucket/

Problem:
  ❌ Complex
  ❌ Data loss if restore fails
  ❌ Slow recovery
```

**NOT RECOMMENDED**

---

## 📊 Comparison Table

| Solution | Cost | Setup | Reliability | Speed | Recommended |
|----------|------|-------|-------------|-------|-------------|
| **S3** | $0.14/mo | 1 hour | ⭐⭐⭐⭐⭐ | Fast | ✅ YES |
| **Google Cloud** | $0.14/mo | 1 hour | ⭐⭐⭐⭐⭐ | Fast | ✅ YES |
| **Azure Blob** | $0.02/mo | 1 hour | ⭐⭐⭐⭐⭐ | Fast | ✅ YES |
| **GridFS** | FREE | 2 hours | ⭐⭐⭐ | Slow | ⚠️ Demo only |
| **Disk + Backup** | $0 | 2 hours | ⭐⭐ | Slow | ❌ NO |

---

## 🚀 Recommended Approach

### Short Term (Demo)
```
Keep current setup:
  - Files on disk (/uploads/)
  - Database: MongoDB
  
Works for:
  ✅ Local development
  ✅ Render demo (temporary)
  
Duration: 1-2 weeks
Cost: FREE

BUT: Data will be lost on Render restart!
```

### Medium Term (Production Ready)
```
Implement S3:
  - Files: AWS S3
  - Database: MongoDB Atlas
  
Works for:
  ✅ Production deployment
  ✅ Persistent storage
  ✅ Scalable to any size
  
Duration: Long term
Cost: $0.14/month (6 GB files)

Best choice! ⭐
```

### Long Term (Enterprise)
```
Advanced setup:
  - Files: AWS S3 + CloudFront (CDN)
  - Database: MongoDB Atlas
  - Cache: Redis
  - Monitoring: CloudWatch
  
Works for:
  ✅ Millions of users
  ✅ Global access
  ✅ High performance
  
Cost: $10-50/month
```

---

## ⏱️ Quick Implementation Plan

### If you want to deploy NOW (temporary):
```
1. Deploy as-is to Render
2. Know that files will be lost on restart
3. Plan S3 migration for next week
4. Mark as "BETA - Not Production Ready"

Time: 30 minutes
Cost: FREE
Data Loss Risk: HIGH ⚠️
```

### If you want to deploy PROPERLY (recommended):
```
1. Implement S3 integration (1-2 hours)
2. Test locally with S3 (30 min)
3. Deploy to Render with S3 (30 min)
4. Upload test files and verify (15 min)

Time: 3-4 hours
Cost: $0.14/month
Data Loss Risk: NONE ✅
```

---

## 🔑 Quick S3 Setup Summary

```
1. AWS Account: 5 minutes
2. Create S3 bucket: 2 minutes
3. Create IAM user: 5 minutes
4. Install npm packages: 1 minute
5. Write S3 utility: 15 minutes
6. Update routes: 30 minutes
7. Test locally: 15 minutes
8. Deploy to Render: 5 minutes
9. Test on Render: 10 minutes

TOTAL: 90 minutes (1.5 hours)
```

---

## 💾 Minimal S3 Integration

**If you want QUICK fix:**

Just update import route to upload to S3 instead of disk:

```javascript
// In import-mongodb.js, replace:
await fs.promises.writeFile(diskPath, pdfBuffer);

// With:
await uploadToS3(pdfBuffer, 'form16-portal-files', s3Key);
```

Keep metadata in DB, but reference S3 instead of disk.

**Time**: 30 minutes  
**Cost**: $0.14/month  
**Safe**: YES ✅

---

## ⚠️ Current Status

### If you deploy NOW to Render:
```
✅ Can login: YES
✅ Can view dashboard: YES
✅ Can import files: YES
✅ Files persist 24 hours: YES
❌ Files persist after restart: NO
❌ Production ready: NO
```

### If you add S3 first:
```
✅ Can login: YES
✅ Can view dashboard: YES
✅ Can import files: YES
✅ Files persist forever: YES
✅ Production ready: YES
```

---

## 🎯 My Recommendation

```
Option A (Quick Deploy):
  Deploy now, add S3 later
  Risk: Temporary data loss
  Timeline: 30 min now, 90 min next week

Option B (Proper Deploy):
  Add S3 now, then deploy
  Risk: None
  Timeline: 120 minutes total

I recommend: Option B
  Extra 90 minutes now saves disaster later
```

---

## ✨ Next Steps

Choose one:

1. **Want quick deployment?**
   - Deploy as-is
   - Plan S3 for later
   - Know files will be lost

2. **Want production ready?**
   - I can help set up S3
   - Will take 2 hours
   - Completely safe

**Which do you prefer?**
