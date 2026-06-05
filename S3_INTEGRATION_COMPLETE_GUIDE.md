# 🚀 Complete S3 Integration Guide - Step by Step

**Time**: 90 minutes  
**Cost**: $0.14/month  
**Result**: Files persist forever on Render ✅

---

## Phase 1: AWS Setup (15 minutes)

### Step 1.1: Create AWS Account
1. Go to: https://aws.amazon.com/
2. Click **Create an AWS Account**
3. Enter:
   - Email: your-email@gmail.com
   - AWS account name: form16-portal
   - Password: strong password
4. Click **Continue**
5. Verify email (check inbox)
6. ✅ Account created

### Step 1.2: Create S3 Bucket
1. Go to: https://console.aws.amazon.com/
2. Search for: **S3**
3. Click **Create bucket**
4. **Bucket name**: `form16-portal-files`
5. **Region**: 
   - USA: `us-east-1`
   - India: `ap-south-1`
   - Europe: `eu-central-1`
6. **Block Public Access**: Leave all ON ✓
7. Click **Create bucket**
8. ✅ Bucket created

### Step 1.3: Create IAM User
1. Search for: **IAM**
2. Click **Users** (left sidebar)
3. Click **Create user**
4. **User name**: `form16-app`
5. Click **Next**
6. Click **Attach policies directly**
7. Search: `S3Full`
8. Select: **AmazonS3FullAccess**
9. Click **Next**
10. Click **Create user**
11. ✅ User created

### Step 1.4: Get Access Keys
1. Click on the user `form16-app`
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Select: **Application running outside AWS**
5. Click **Next**
6. Click **Create access key**
7. **COPY AND SAVE**:
   ```
   Access Key ID: AKIAIOSFODNN7EXAMPLE
   Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```
8. ✅ Keys saved securely

---

## Phase 2: Backend Code (60 minutes)

### Step 2.1: Install AWS SDK
```bash
cd /Users/shivamojha/Desktop/Test/form16-portal/backend
npm install aws-sdk
```

### Step 2.2: Create S3 Utility File

Create: `backend/src/utils/s3.js`

```javascript
import AWS from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET = process.env.S3_BUCKET || 'form16-portal-files';

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Filename (e.g., "documents/PAN/2024/form16_a.pdf")
 * @returns {Promise<string>} S3 file URL
 */
export async function uploadToS3(fileBuffer, fileName) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: fileName,
      Body: fileBuffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256'
    };

    const result = await s3.upload(params).promise();
    console.log(`✅ Uploaded to S3: ${fileName}`);
    return result.Location; // Full S3 URL
  } catch (error) {
    console.error(`❌ S3 Upload Error: ${error.message}`);
    throw error;
  }
}

/**
 * Download file from S3
 * @param {string} fileName - S3 key (e.g., "documents/PAN/2024/form16_a.pdf")
 * @returns {Promise<Buffer>} File content
 */
export async function downloadFromS3(fileName) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: fileName
    };

    const result = await s3.getObject(params).promise();
    console.log(`✅ Downloaded from S3: ${fileName}`);
    return result.Body; // Buffer
  } catch (error) {
    console.error(`❌ S3 Download Error: ${error.message}`);
    throw error;
  }
}

/**
 * Delete file from S3
 * @param {string} fileName - S3 key
 * @returns {Promise<void>}
 */
export async function deleteFromS3(fileName) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: fileName
    };

    await s3.deleteObject(params).promise();
    console.log(`✅ Deleted from S3: ${fileName}`);
  } catch (error) {
    console.error(`❌ S3 Delete Error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate S3 signed URL (for direct frontend downloads)
 * @param {string} fileName - S3 key
 * @param {number} expiresIn - Seconds (default: 1 hour)
 * @returns {string} Signed URL
 */
export function getSignedUrl(fileName, expiresIn = 3600) {
  const params = {
    Bucket: BUCKET,
    Key: fileName,
    Expires: expiresIn
  };

  return s3.getSignedUrl('getObject', params);
}

export default {
  uploadToS3,
  downloadFromS3,
  deleteFromS3,
  getSignedUrl
};
```

### Step 2.3: Update Documents Table

Edit: `backend/src/services/db.js`

Update `createDocument()` to accept S3 fields:

```javascript
export async function createDocument(document) {
  const collection = await getCollection(Collections.DOCUMENTS);
  
  // Ensure S3 fields exist
  const docWithS3 = {
    ...document,
    // Old field (for backward compatibility):
    file_path: document.file_path || null,
    
    // New S3 fields:
    s3_key: document.s3_key || null,
    s3_bucket: document.s3_bucket || process.env.S3_BUCKET || 'form16-portal-files',
    s3_url: document.s3_url || null
  };
  
  return await collection.insertOne(docWithS3);
}
```

### Step 2.4: Update Import Route

Edit: `backend/src/routes/import-mongodb.js`

Replace disk saves with S3:

```javascript
// At top of file, add:
import { uploadToS3 } from '../utils/s3.js';

// Find the section where PDFs are saved (around line 726)
// Replace this:
// const relativePath = path.join('uploads', 'documents', ...);
// await fs.promises.writeFile(diskPath, pdfBuffer);

// With this:
const s3Key = `documents/${extractedData.pan}/${safeYear}/${docType}/${fileName}`;
const s3Url = await uploadToS3(pdfBuffer, s3Key);

// Then when creating document:
const documentData = {
  // ... existing fields ...
  
  // OLD:
  // file_path: relativePath,
  
  // NEW:
  s3_key: s3Key,
  s3_bucket: 'form16-portal-files',
  s3_url: s3Url,
  
  // Keep for reference:
  original_file_name: fileName,
  file_size: pdfBuffer.length
};

await db.createDocument(documentData);
```

### Step 2.5: Update Download Endpoint

Edit: `backend/src/routes/documents-mongodb.js`

Update download handler:

```javascript
// Find the download endpoint (/:id/download)
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const document = await db.getDocument(new ObjectId(req.params.id));

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if file is in S3 (new) or disk (old)
    if (document.s3_key) {
      // Download from S3
      const fileBuffer = await downloadFromS3(document.s3_key);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`);
      res.send(fileBuffer);
    } else if (document.file_path) {
      // Fallback to old disk method (for backward compatibility)
      const filePath = path.join(process.cwd(), document.file_path);
      res.download(filePath, document.file_name);
    } else {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});
```

### Step 2.6: Update Preview Endpoint

Similar to download, update preview:

```javascript
router.get('/:id/preview', authenticateToken, async (req, res) => {
  try {
    const document = await db.getDocument(new ObjectId(req.params.id));

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.s3_key) {
      // Get signed URL for preview
      const signedUrl = getSignedUrl(document.s3_key, 3600);
      return res.json({ url: signedUrl });
    } else if (document.file_path) {
      // Old method
      const filePath = path.join(process.cwd(), document.file_path);
      res.sendFile(filePath);
    } else {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to get preview' });
  }
});
```

### Step 2.7: Update Delete Endpoint

When deleting documents, also delete from S3:

```javascript
// In delete document endpoint
router.delete('/:id', authenticateToken, requireAdmin, auditLog('delete', 'document'), async (req, res) => {
  try {
    const document = await db.getDocument(new ObjectId(req.params.id));

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from S3 if exists
    if (document.s3_key) {
      await deleteFromS3(document.s3_key);
    }

    // Delete from disk if exists (backward compatibility)
    if (document.file_path) {
      try {
        const filePath = path.join(process.cwd(), document.file_path);
        await fs.unlink(filePath);
      } catch (e) {
        console.warn(`Could not delete file: ${document.file_path}`);
      }
    }

    // Delete from database
    await db.deleteDocument(new ObjectId(req.params.id));

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});
```

---

## Phase 3: Environment Variables (5 minutes)

### Step 3.1: Local Development

Create/Update: `backend/.env.mongodb`

```
MONGO_URI=mongodb+srv://form16user:PASSWORD@form16-portal.xxxxx.mongodb.net/form16_portal?retryWrites=true&w=majority
DB_NAME=form16_portal
PORT=5002
NODE_ENV=development
JWT_SECRET=ssb-form16-secret-key-2024

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
S3_BUCKET=form16-portal-files
```

### Step 3.2: Render Deployment

In Render Dashboard:
1. Go to your backend service
2. Go to **Environment** tab
3. Add these variables:
   ```
   AWS_ACCESS_KEY_ID = AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   AWS_REGION = us-east-1
   S3_BUCKET = form16-portal-files
   ```
4. Click **Save**
5. Render will auto-redeploy

---

## Phase 4: Testing (10 minutes)

### Step 4.1: Test Locally

```bash
cd backend

# Make sure env vars loaded
cat .env.mongodb | grep AWS

# Test upload
node -e "
import { uploadToS3 } from './src/utils/s3.js';
const buffer = Buffer.from('test pdf content');
uploadToS3(buffer, 'test/test-file.pdf')
  .then(() => console.log('✅ Upload success'))
  .catch(err => console.error('❌ Upload failed:', err));
"
```

### Step 4.2: Test in Application

1. Start backend: `npm start`
2. Login as admin
3. Go to Import Center
4. Upload test ZIP file
5. Check AWS S3 Console:
   - Should see files in bucket ✅

### Step 4.3: Test Download

1. Login as employee
2. View documents
3. Click download
4. File should download ✅

---

## Phase 5: Deployment (10 minutes)

### Step 5.1: Push Code to GitHub

```bash
cd /Users/shivamojha/Desktop/Test/form16-portal

git add .
git commit -m "Add AWS S3 integration for persistent file storage"
git push origin main
```

### Step 5.2: Render Auto-Redeploy

1. Render watches your GitHub repo
2. Sees new push
3. Auto-redeploys backend
4. Uses new S3 code ✅

### Step 5.3: Verify on Render

1. Go to Render Dashboard
2. Watch build logs
3. Should see:
   ```
   ✓ npm install completed
   ✓ Build successful
   ✅ Live
   ```

4. Test on live URL:
   - Upload document
   - File goes to S3 ✅
   - Download works ✅

---

## ✅ Verification Checklist

After setup:

- [ ] AWS S3 bucket created
- [ ] IAM user created with access keys
- [ ] S3 utility file created (`backend/src/utils/s3.js`)
- [ ] Database schema updated (S3 fields added)
- [ ] Import route updated (uses S3)
- [ ] Download endpoint updated (reads from S3)
- [ ] Preview endpoint updated (uses signed URLs)
- [ ] Delete endpoint updated (deletes from S3)
- [ ] Environment variables set (local)
- [ ] Environment variables set (Render)
- [ ] Code pushed to GitHub
- [ ] Backend redeployed on Render
- [ ] Test file uploaded
- [ ] File appears in S3 console
- [ ] Test file downloaded successfully
- [ ] S3 deletion works

---

## Troubleshooting

### "AWS credentials error"
```
Check:
1. Access Key ID correct?
2. Secret Access Key correct?
3. No extra spaces?
4. Environment variables loaded?
```

### "S3 bucket not found"
```
Check:
1. Bucket name correct: form16-portal-files
2. Region correct in code
3. IAM user has S3FullAccess
4. Bucket exists in AWS console
```

### "File not found on download"
```
Check:
1. S3_key stored correctly in DB
2. File exists in S3 console
3. IAM user can read S3
4. No typos in key
```

### "Render still using old code"
```
Solution:
1. Manual redeploy in Render
2. Or push code again
3. Wait 3-5 minutes
```

---

## Cost Summary

```
AWS S3 (6 GB files):
- Storage: 6 GB × $0.023/month = $0.138
- Requests: ~1000 gets/month × $0.0004 = $0.40
- Total: ~$0.54/month

Much cheaper than: Dedicated storage service
Compared to: Alternative storage ($5-50/month)

Worth it? YES! ✅
```

---

## Done! 🎉

Your portal now has:
- ✅ Persistent file storage on S3
- ✅ Files never deleted on Render restart
- ✅ Professional architecture
- ✅ Scalable to millions of files
- ✅ Production ready

**Total time: 90 minutes**  
**Total cost: $0.54/month**  
**Peace of mind: PRICELESS** 💎
