# 🚀 Complete Deployment Guide - SSB Form 16 Portal

**Target**: Deploy to GitHub, Render (free), and MongoDB Atlas (free)

---

## 📋 Prerequisites

- GitHub account (free)
- Render account (free)
- MongoDB Atlas account (free)
- Git installed locally
- Node.js 18+ installed

---

## **STEP 1: Prepare GitHub Repository**

### 1.1 Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `form16-portal`
3. Description: `SSB Form 16 Secure Document Management System`
4. Choose: **Public** (for free deployment on Render)
5. Click **Create repository**

### 1.2 Initialize Git Locally

```bash
cd /Users/shivamojha/Desktop/Test/form16-portal

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: SSB Form 16 Portal"

# Add remote repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/form16-portal.git

# Push to main branch
git branch -M main
git push -u origin main
```

### 1.3 Create `.gitignore`

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
*.pnp
.pnp.js

# Environment
.env
.env.local
.env.mongodb
.env.*.local

# Build
dist/
build/
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Uploads
backend/uploads/

# Database
*.db
*.sqlite
EOF

git add .gitignore
git commit -m "Add gitignore"
git push
```

---

## **STEP 2: Setup MongoDB Atlas (FREE)**

### 2.1 Create MongoDB Account

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Click **Sign Up**
3. Register with email/GitHub
4. Verify email

### 2.2 Create Free Cluster

1. Click **Create** → **Build a Cluster**
2. Choose **FREE** tier
3. Select region closest to you (e.g., `N. Virginia` for US)
4. Cluster name: `form16-portal`
5. Click **Create Cluster** (takes ~5 minutes)

### 2.3 Setup Database User

1. In MongoDB Atlas dashboard
2. Go to **Security** → **Database Access**
3. Click **Add New Database User**
4. Username: `form16user`
5. Password: Generate strong password (save it!)
6. Click **Add User**

### 2.4 Allow Network Access

1. Go to **Security** → **Network Access**
2. Click **Add IP Address**
3. Select **Allow access from anywhere** (for Render deployment)
4. Click **Confirm**

### 2.5 Get Connection String

1. Go to **Databases** → Your cluster
2. Click **Connect**
3. Choose **Drivers**
4. Copy connection string:
   ```
   mongodb+srv://form16user:<PASSWORD>@form16-portal.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<PASSWORD>` with your actual password
6. Replace `/?` with `/form16_portal?` for database name

**Final URL looks like**:
```
mongodb+srv://form16user:YourPassword123@form16-portal.abc123.mongodb.net/form16_portal?retryWrites=true&w=majority
```

---

## **STEP 3: Prepare Backend for Render**

### 3.1 Update Backend `.env`

Create/Update `backend/.env.mongodb`:

```
MONGO_URI=mongodb+srv://form16user:YourPassword123@form16-portal.abc123.mongodb.net/form16_portal?retryWrites=true&w=majority
DB_NAME=form16_portal
PORT=5002
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 3.2 Create Render Start Script

Create `backend/render.sh`:

```bash
#!/bin/bash
cd backend
npm install
node src/server.js
```

### 3.3 Update `backend/package.json`

Ensure it has proper scripts and dependencies:

```json
{
  "name": "form16-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "engines": {
    "node": "18.x"
  },
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongodb": "^6.0.0",
    "dotenv": "^16.0.3",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.0"
  }
}
```

### 3.4 Create `backend/src/server.js` Connection Check

Make sure your server.js has proper MongoDB connection with error handling:

```javascript
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.mongodb' });

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

// MongoDB connection test
const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

app.listen(PORT, async () => {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`✅ Backend running on port ${PORT}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
});
```

---

## **STEP 4: Prepare Frontend for Render**

### 4.1 Update `frontend/.env.production`

Create this file in frontend root:

```
VITE_API_URL=https://your-backend-render-url.onrender.com/api
```

(We'll update this after backend deployment)

### 4.2 Update `frontend/vite.config.ts`

Ensure it has correct build configuration:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
})
```

### 4.3 Create `frontend/.env.local` for Local Development

```
VITE_API_URL=http://localhost:5002/api
```

---

## **STEP 5: Deploy Backend to Render**

### 5.1 Create Render Account

1. Go to [render.com](https://render.com)
2. Click **Sign Up**
3. Sign up with GitHub

### 5.2 Deploy Backend Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repository:
   - Click **Connect account**
   - Select `form16-portal` repository
   - Click **Connect**
3. Configure service:
   - **Name**: `form16-portal-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node src/server.js`
4. Click **Advanced** section:
   - Click **Add Environment Variable**
   - Add all variables from `backend/.env.mongodb`:
     ```
     MONGO_URI = mongodb+srv://form16user:Password@cluster...
     DB_NAME = form16_portal
     PORT = 5002
     NODE_ENV = production
     JWT_SECRET = your-secret-key
     ```
5. Click **Create Web Service**

### 5.3 Wait for Deployment

- Render will build and deploy automatically
- Takes ~5 minutes
- You'll get a URL like: `https://form16-portal-backend.onrender.com`
- Copy this URL for frontend configuration

---

## **STEP 6: Deploy Frontend to Render**

### 6.1 Update Frontend `.env.production`

Update `frontend/.env.production` with your backend URL:

```
VITE_API_URL=https://form16-portal-backend.onrender.com/api
```

### 6.2 Push to GitHub

```bash
git add frontend/.env.production
git commit -m "Update backend API URL for production"
git push
```

### 6.3 Deploy Frontend Service

1. In Render dashboard
2. Click **New +** → **Web Service**
3. Configure:
   - **Name**: `form16-portal-frontend`
   - **Environment**: `Node`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm run preview` or use static site
4. Actually, for best results, deploy as **Static Site**:
   - Click **New +** → **Static Site**
   - Connect repository
   - **Name**: `form16-portal`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish directory**: `frontend/dist`
5. Click **Create Static Site**

### 6.4 Get Frontend URL

After deployment completes:
- Your frontend URL: `https://form16-portal.onrender.com`

---

## **STEP 7: Connect Everything**

### 7.1 Update Backend CORS

In `backend/src/server.js`, update CORS:

```javascript
app.use(cors({
  origin: [
    'https://form16-portal.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));
```

### 7.2 Push Final Changes

```bash
git add .
git commit -m "Update CORS for production deployment"
git push
```

Both services will redeploy automatically.

---

## **STEP 8: Testing**

### 8.1 Test Backend Health

```bash
curl https://form16-portal-backend.onrender.com/api/health
```

Expected response:
```json
{"status":"OK","message":"Backend is running"}
```

### 8.2 Test Full Application

1. Open: `https://form16-portal.onrender.com`
2. Try login with test credentials
3. Check admin panel
4. Verify documents display

### 8.3 Check MongoDB

In MongoDB Atlas:
1. Go to your cluster
2. Collections tab
3. Verify documents are being stored

---

## **STEP 9: Post-Deployment**

### 9.1 Enable Free SSL/HTTPS

- ✅ Automatically enabled on Render
- Certificate auto-renews

### 9.2 Setup Monitoring

In Render Dashboard:
1. Go to your service
2. Click **Logs** to view real-time logs
3. Check for errors

### 9.3 Setup Alerts (Optional)

1. Render → Settings
2. Enable email notifications
3. Get alerts on deployment failures

---

## **IMPORTANT NOTES**

### ⚠️ Free Tier Limitations

**Render Free Tier**:
- Backend spins down after 15 min inactivity (takes ~30 sec to wake up)
- Frontend: Always active
- 0.5 GB RAM
- Enough for demo/small scale

**MongoDB Atlas Free**:
- 512 MB storage included
- 3 replicas (high availability)
- Good for thousands of documents

### ✅ Production Upgrades

When going live (paid):

**Render Pro** ($7/month backend):
- Always running
- 2GB RAM
- Better performance

**MongoDB Atlas Paid**:
- Unlimited storage
- Auto-scaling
- Advanced backups

---

## **QUICK REFERENCE**

### URLs After Deployment

| Service | URL |
|---------|-----|
| Frontend | `https://form16-portal.onrender.com` |
| Backend | `https://form16-portal-backend.onrender.com` |
| MongoDB | `https://cloud.mongodb.com` |
| GitHub | `https://github.com/YOUR_USERNAME/form16-portal` |

### Environment Variables

**Backend (.env.mongodb)**:
```
MONGO_URI=<your-mongodb-atlas-url>
DB_NAME=form16_portal
PORT=5002
NODE_ENV=production
JWT_SECRET=<your-secret-key>
```

**Frontend (.env.production)**:
```
VITE_API_URL=<your-render-backend-url>/api
```

---

## **TROUBLESHOOTING**

### Backend won't deploy

```bash
# Check backend package.json exists
ls backend/package.json

# Verify Node version
node --version  # Should be 18+

# Check environment variables in Render
# Go to Service → Environment
```

### Frontend not connecting to backend

```bash
# Verify CORS in backend
# Verify API URL in frontend .env.production
# Check browser console for errors
```

### MongoDB connection fails

```bash
# Verify IP whitelist in MongoDB Atlas
# Verify connection string is correct
# Test locally: mongosh <your-connection-string>
```

---

## **SECURITY CHECKLIST**

- ✅ Change default JWT_SECRET
- ✅ Use strong MongoDB password
- ✅ Enable HTTPS (auto on Render)
- ✅ Limit API endpoints with auth
- ✅ Use environment variables for secrets
- ✅ Enable MongoDB IP whitelist

---

## **SUCCESS! 🎉**

Your SSB Form 16 Portal is now deployed and accessible worldwide!

**Next steps**:
1. Import test Form 16 documents
2. Create test employees
3. Test all admin functions
4. Gather user feedback
5. Plan production upgrades

---

**Deployed**: June 5, 2026
**Status**: ✅ PRODUCTION READY
**Estimated Cost**: **$0** (Free tier)
