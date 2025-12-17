# 🚀 Bethesda Mission - Full Stack Deployment Guide

Complete deployment guide for the Bethesda Shelter Management System on Railway.

## 📋 System Overview

- **Backend API**: FastAPI + LiveKit Voice Agent + PostgreSQL
- **Frontend Dashboard**: React + TypeScript + Tailwind CSS
- **Phone System**: LiveKit integrated with Twilio (+15188404103)

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   React App     │ ───> │   FastAPI API    │ <──> │   PostgreSQL    │
│   (Frontend)    │      │   (Backend)      │      │   (Database)    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                 │
                                 ▼
                         ┌──────────────────┐
                         │  LiveKit Agent   │
                         │  (Voice System)  │
                         └──────────────────┘
                                 │
                                 ▼
                         ┌──────────────────┐
                         │  Twilio Phone    │
                         │ +15188404103     │
                         └──────────────────┘
```

## 🚂 Railway Deployment

### Step 1: Install Railway CLI

```bash
# macOS
brew install railway

# Or via npm
npm install -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```

### Step 3: Deploy Backend (if not already deployed)

```bash
# Navigate to project root
cd /Users/elijah/Bethesda

# Link to existing Railway project or create new one
railway link

# Set environment variables (if not already set)
railway variables set DATABASE_URL="your-postgres-url"
railway variables set OPENAI_API_KEY="your-openai-key"
railway variables set LIVEKIT_URL="your-livekit-url"
railway variables set LIVEKIT_API_KEY="your-livekit-key"
railway variables set LIVEKIT_API_SECRET="your-livekit-secret"
railway variables set TWILIO_ACCOUNT_SID="your-twilio-sid"
railway variables set TWILIO_AUTH_TOKEN="your-twilio-token"
railway variables set TWILIO_PHONE_NUMBER="+15188404103"

# Deploy backend
git add .
git commit -m "Deploy backend with voice agent"
git push

# Or use Railway CLI
railway up
```

### Step 4: Deploy Frontend

```bash
# Navigate to Frontend directory
cd src/Frontend

# Create new Railway service for frontend
railway init

# Set frontend environment variables
railway variables set VITE_API_URL="https://your-backend-url.up.railway.app"

# Deploy frontend
railway up

# Get the frontend URL
railway domain
```

### Step 5: Update Backend CORS

After deploying the frontend, update your backend's CORS settings to include the frontend URL:

```bash
# In your backend Railway service
railway variables set FRONTEND_URL="https://your-frontend-url.up.railway.app"
```

Then update `src/main.py` CORS configuration:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-frontend-url.up.railway.app",
        "http://localhost:5173",  # Keep for local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 🔧 Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# OpenAI
OPENAI_API_KEY=sk-...

# LiveKit
LIVEKIT_URL=wss://your-livekit-url
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+15188404103

# App Config
DEBUG=false
TOTAL_BEDS=108
HOLD_DURATION_HOURS=3
```

### Frontend (.env.production)
```bash
VITE_API_URL=https://your-backend-url.up.railway.app
```

## 📱 Testing the Deployment

### 1. Test Backend Health
```bash
curl https://your-backend-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-16T..."
}
```

### 2. Test Frontend
Visit: `https://your-frontend-url.up.railway.app`

You should see:
- ✅ Bed availability dashboard
- ✅ Active reservations list
- ✅ Real-time updates every 10 seconds
- ✅ Professional Bethesda branding

### 3. Test Phone System
Call: **+1 (518) 840-4103**

The agent should:
- ✅ Greet you professionally
- ✅ Ask about your situation
- ✅ Check bed availability
- ✅ Provide bed number and confirmation code
- ✅ Update the dashboard in real-time

## 🔄 Continuous Deployment

Both services are configured for automatic deployment:

```bash
# Any push to main branch will trigger deployment
git add .
git commit -m "Update: description"
git push origin main
```

Railway will automatically:
1. Detect changes
2. Build new containers
3. Run tests (if configured)
4. Deploy with zero downtime

## 🐛 Troubleshooting

### Backend Issues

**Database connection failed:**
```bash
# Check database status
railway logs --service backend

# Verify DATABASE_URL is set
railway variables
```

**LiveKit agent not responding:**
```bash
# Check worker process
railway logs --service backend

# Verify Procfile has both processes
cat Procfile
# Should show:
# web: python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
# worker: python src/livekit_agent.py start
```

### Frontend Issues

**API calls failing (CORS):**
- Check backend CORS settings include your frontend URL
- Verify `VITE_API_URL` is set correctly in Railway

**Build fails:**
```bash
# Check build logs
railway logs

# Verify all dependencies are in package.json
cd src/Frontend
npm install
npm run build
```

### Phone System Issues

**Calls not connecting:**
1. Check Twilio console for webhook errors
2. Verify LiveKit service is running
3. Check Railway logs for LiveKit agent

## 📊 Monitoring

### Backend Metrics
```bash
# View backend logs
railway logs --service backend

# View recent errors
railway logs --service backend --filter error
```

### Frontend Metrics
```bash
# View frontend logs
railway logs --service frontend

# Check build status
railway status
```

## 🔐 Security Checklist

- [ ] All API keys stored as Railway environment variables
- [ ] CORS configured with specific frontend URL
- [ ] Database has strong password
- [ ] HTTPS enabled on both services (automatic on Railway)
- [ ] `.env` files in `.gitignore`
- [ ] Twilio webhooks use HTTPS

## 📈 Scaling

Railway automatically handles scaling, but you can configure:

```bash
# Set resource limits (in Railway dashboard)
# Memory: 512MB - 8GB
# CPU: Shared - Dedicated

# Monitor usage
railway status
```

## 🆘 Support

- **Railway Docs**: https://docs.railway.app
- **LiveKit Docs**: https://docs.livekit.io
- **Project Issues**: https://github.com/erose2502/bethesda-shelter-agent/issues

## 📝 Next Steps

After deployment:
1. ✅ Test all features end-to-end
2. ✅ Configure custom domain (optional)
3. ✅ Set up monitoring alerts
4. ✅ Train staff on dashboard usage
5. ✅ Document operational procedures

---

**Deployed By:** Elijah Rose  
**Project:** Bethesda Mission Shelter Management  
**Date:** December 16, 2025  
**Status:** ✨ Production Ready
