# ⚡ Quick Deploy Checklist - 30 Minutes

**Goal**: Deploy SSB Form 16 Portal in 30 minutes for FREE

---

## ✅ Pre-Flight Check (5 min)

- [ ] GitHub account created
- [ ] Render account created  
- [ ] MongoDB Atlas account created
- [ ] Git installed locally
- [ ] Node.js 18+ installed

---

## ✅ Phase 1: MongoDB Setup (5 min)

**Time: 0-5 minutes**

```bash
# Go to https://cloud.mongodb.com
# 1. Sign Up → Verify Email
# 2. Create Free Cluster
#    - Region: Closest to you
#    - Cluster name: form16-portal
#    - Click Create (wait 5 min)
# 3. Create User
#    - Username: form16user
#    - Password: [Save this!]
#    - Add User
# 4. Network Access
#    - Add IP Address
#    - Allow from anywhere (0.0.0.0/0)
# 5. Connect
#    - Get connection string
#    - Replace <PASSWORD> with actual password
#    - Format: mongodb+srv://form16user:PASSWORD@cluster...mongodb.net/form16_portal?retryWrites=true&w=majority
```

**Save these values**:
- MongoDB Connection String: `________________________________________`

---

## ✅ Phase 2: GitHub Setup (5 min)

**Time: 5-10 minutes**

```bash
# Go to https://github.com/new
# 1. Repository name: form16-portal
# 2. Public (important for free deployment!)
# 3. Create repository

# Locally:
cd /Users/shivamojha/Desktop/Test/form16-portal
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/form16-portal.git
git branch -M main
git push -u origin main
```

**Save these values**:
- GitHub Repo: `https://github.com/YOUR_USERNAME/form16-portal`

---

## ✅ Phase 3: Backend Deployment (5 min)

**Time: 10-15 minutes**

```bash
# 1. Go to https://render.com
# 2. Sign Up with GitHub
# 3. New → Web Service
# 4. Connect repository
# 5. Configure:
#    Name: form16-portal-backend
#    Environment: Node
#    Build: cd backend && npm install
#    Start: node src/server.js
# 6. Environment Variables (copy from clipboard):
#    MONGO_URI = mongodb+srv://form16user:PASSWORD@...
#    DB_NAME = form16_portal
#    PORT = 5002
#    NODE_ENV = production
#    JWT_SECRET = my-super-secret-key-12345
# 7. Create Web Service
# 8. Wait for deployment (shows green "Live")
```

**Important**: Copy backend URL after deployment!

**Save these values**:
- Backend URL: `https://form16-portal-backend.onrender.com`

---

## ✅ Phase 4: Frontend Deployment (5 min)

**Time: 15-20 minutes**

```bash
# Update frontend/.env.production with backend URL from above
echo "VITE_API_URL=https://form16-portal-backend.onrender.com/api" > frontend/.env.production

# Push to GitHub
git add frontend/.env.production
git commit -m "Add production API URL"
git push

# 1. Go to https://render.com/dashboard
# 2. New → Static Site
# 3. Connect your repository
# 4. Configure:
#    Name: form16-portal
#    Build Command: cd frontend && npm install && npm run build
#    Publish Directory: frontend/dist
# 5. Create Static Site
# 6. Wait for deployment
```

**Save these values**:
- Frontend URL: `https://form16-portal.onrender.com`

---

## ✅ Phase 5: Testing (5 min)

**Time: 20-25 minutes**

```bash
# Test Backend Health
curl https://form16-portal-backend.onrender.com/api/health

# Expected: {"status":"OK","message":"Backend is running"}

# Test Frontend
# Open: https://form16-portal.onrender.com
# Try login with any PAN and name
```

---

## ✅ DONE! 🎉

**Your portal is live!**

| Component | Status | URL |
|-----------|--------|-----|
| Frontend | ✅ Live | https://form16-portal.onrender.com |
| Backend | ✅ Live | https://form16-portal-backend.onrender.com |
| Database | ✅ Live | MongoDB Atlas |
| Cost | ✅ FREE | $0/month |

---

## 🚀 Next Actions

1. **Import Documents**
   - Go to `/admin`
   - Admin credentials: auto-created
   - Import test ZIP with Form 16 PDFs

2. **Create Employees**
   - Via import process
   - Add employee data

3. **Test Employee Login**
   - Login with employee PAN
   - View documents

4. **Invite Users**
   - Share URL with team
   - Each person logs in

---

## ⚠️ Important Notes

**Backend Spins Down** (Free Tier):
- If unused for 15 min → goes to sleep
- First request takes ~30 sec to wake
- Production upgrade fixes this ($7/month)

**Storage Limits**:
- MongoDB: 512 MB (can store ~100k documents)
- Upgrade when you need more

**HTTPS**: ✅ Automatic (Render provides free SSL)

---

## 🔧 Troubleshooting

**Frontend shows blank page?**
- Check browser console (F12)
- Verify API URL in frontend `.env.production`
- Check backend is running

**Backend not connecting to MongoDB?**
- Verify connection string has password
- Check MongoDB IP whitelist allows 0.0.0.0/0
- Test connection locally: `mongosh <connection-string>`

**Render deployment failed?**
- Check build logs in Render dashboard
- Verify Node version is 18+
- Check environment variables are set

---

## 📞 Support

**Docs**: See `DEPLOYMENT_GUIDE.md` for detailed steps

**Issues**: Check Render/MongoDB dashboards for error logs

---

**Deployment Time**: ~30 minutes ⏱️
**Cost**: $0 (free tier) 💰
**Status**: ✅ LIVE 🚀
