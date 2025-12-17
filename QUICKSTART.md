# 🚀 Quick Start - Deploy to Railway

Follow these steps to deploy your complete Bethesda Mission system.


## ✅ Prerequisites Checklist

- [x] Railway CLI installed (v4.15.0)
- [x] GitHub repository pushed
- [x] Backend already running on Railway
- [ ] Railway account logged in

## 📝 Step-by-Step Deployment

### 1️⃣ Login to Railway

```bash
railway login
```

This will open your browser. Login and authorize the CLI.

### 2️⃣ Link Backend Service (Verify Existing)

```bash
cd /Users/elijah/Bethesda
railway link
```

Select your existing project: **bethesda-shelter-agent**

### 3️⃣ Verify Backend Environment Variables

```bash
railway variables
```

Make sure these are set:
- ✅ `DATABASE_URL`
- ✅ `OPENAI_API_KEY`
- ✅ `LIVEKIT_URL`
- ✅ `LIVEKIT_API_KEY`
- ✅ `LIVEKIT_API_SECRET`
- ✅ `TWILIO_ACCOUNT_SID`
- ✅ `TWILIO_AUTH_TOKEN`
- ✅ `TWILIO_PHONE_NUMBER`

### 4️⃣ Deploy Backend Updates

```bash
# Still in /Users/elijah/Bethesda
railway up
```

This deploys your updated backend with the latest code.

### 5️⃣ Create Frontend Service

Railway needs a separate service for the frontend. You have two options:

#### Option A: Via Railway Dashboard (Recommended)

1. Go to https://railway.app/dashboard
2. Open your **bethesda-shelter-agent** project
3. Click **"+ New Service"**
4. Select **"GitHub Repo"**
5. Choose: **erose2502/bethesda-shelter-agent**
6. Set **Root Directory**: `src/Frontend`
7. Railway will auto-detect it's a Vite app
8. Click **"Deploy"**

#### Option B: Via CLI

```bash
# Navigate to frontend
cd /Users/elijah/Bethesda/src/Frontend

# Initialize Railway in this directory
railway init

# Link to the same project
# Select: "Link to existing project"
# Choose: bethesda-shelter-agent

# Set service name
railway service create frontend

# Deploy
railway up
```

### 6️⃣ Configure Frontend Environment Variables

After deployment, set the API URL:

```bash
cd /Users/elijah/Bethesda/src/Frontend

# Get your backend URL first
railway domain --service backend

# Then set it for frontend
railway variables set VITE_API_URL=https://bethesda-shelter-agent-production.up.railway.app
```

### 7️⃣ Get Frontend URL

```bash
# Generate a public URL for your frontend
railway domain

# This will give you something like:
# https://frontend-production-xxxx.up.railway.app
```

### 8️⃣ Update Backend CORS

Update your backend to allow the frontend URL:

```bash
cd /Users/elijah/Bethesda

# Add frontend URL to environment
railway variables set FRONTEND_URL=https://your-frontend-url.up.railway.app
```

Then update `src/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,  # Railway frontend
        "http://localhost:5173",  # Local development
        "http://localhost:5174",  # Local development (alternate)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit and push:

```bash
git add src/main.py
git commit -m "Update CORS for frontend"
git push origin main

# Redeploy backend
railway up
```

### 9️⃣ Test Everything

#### Test Backend
```bash
curl https://bethesda-shelter-agent-production.up.railway.app/health
```

Expected: `{"status":"healthy","timestamp":"..."}`

#### Test Frontend
Visit your frontend URL in a browser. You should see:
- ✅ Professional Bethesda dashboard
- ✅ Bed availability grid with 3 categories
- ✅ Active reservations
- ✅ Real-time updates

#### Test Phone System
Call: **+1 (518) 840-4103**

The voice agent should:
- ✅ Answer professionally
- ✅ Reserve a bed
- ✅ Provide confirmation code
- ✅ Show up on dashboard immediately

## 🎯 Quick Commands Reference

```bash
# View logs
railway logs                    # Current service
railway logs --service backend  # Backend logs
railway logs --service frontend # Frontend logs

# Check status
railway status

# View environment variables
railway variables

# Redeploy
railway up

# Open dashboard
railway open
```

## 🔥 Troubleshooting

### Frontend build fails
```bash
cd /Users/elijah/Bethesda/src/Frontend
npm install
npm run build

# If successful, try deploying again
railway up
```

### API calls failing (404)
- Check `VITE_API_URL` is set correctly
- Verify backend is running: `railway logs --service backend`
- Check CORS settings in backend

### Phone calls not working
- Verify LiveKit environment variables
- Check worker process: `railway logs --service backend --filter worker`
- Test Twilio webhook configuration

## 📊 Monitor Your Deployment

```bash
# Real-time logs
railway logs --follow

# Check resource usage
railway status

# View recent deployments
railway deployments
```

## 🎉 Success!

Once everything is deployed:

1. ✅ Backend API: `https://bethesda-shelter-agent-production.up.railway.app`
2. ✅ Frontend Dashboard: `https://your-frontend-url.up.railway.app`
3. ✅ Phone System: `+1 (518) 840-4103`

Share the frontend URL with your house supervisors! 🏠

## 🔒 Security Notes

- All environment variables are encrypted by Railway
- HTTPS is automatic for all Railway services
- Database credentials are never exposed
- API keys are stored securely

## 📝 Next Steps

- [ ] Set up custom domain (optional)
- [ ] Configure monitoring alerts
- [ ] Train staff on dashboard
- [ ] Test end-to-end workflow
- [ ] Document operational procedures

---

Need help? Check the full [DEPLOYMENT.md](DEPLOYMENT.md) guide!
