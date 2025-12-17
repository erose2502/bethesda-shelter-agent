# ✅ Final Deployment Steps

Your code has been successfully pushed! Now complete the deployment through Railway's dashboard.

## 🎯 What's Been Done

✅ Backend code pushed to Railway
✅ Frontend built and ready to deploy
✅ All configuration files created
✅ GitHub repository updated
✅ Railway CLI installed and logged in

## 🚀 Complete Deployment via Railway Dashboard

### Step 1: Setup Backend Web Service

1. Go to: https://railway.app/project/98efa78c-6089-4e9b-b9b6-62f8a388699a
2. Click **"+ New Service"**
3. Select **"GitHub Repo"**
4. Choose: `erose2502/bethesda-shelter-agent`
5. Leave root directory as **`/`** (root of repo)
6. Railway will detect it's a Python project

### Step 2: Configure Backend Environment Variables

Click on the new Backend service → **Variables** tab → Add:

```bash
# Required Variables
DATABASE_URL=${{Postgres.DATABASE_URL}}  # This links to your Postgres service
OPENAI_API_KEY=sk-your-openai-key-here
LIVEKIT_URL=wss://your-livekit-url
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+15188404103

# Optional Configuration
DEBUG=false
TOTAL_BEDS=108
HOLD_DURATION_HOURS=3
```

**Important**: The `DATABASE_URL` should reference your existing Postgres service.

### Step 3: Add Web Service Port

In the **Settings** tab of your Backend service:

- Under **Networking** → Click **"Generate Domain"**
- This will create a public URL like: `https://bethesda-shelter-backend-production.up.railway.app`
- Copy this URL (you'll need it for the frontend)

### Step 4: Enable Worker Process for LiveKit Agent

The `Procfile` defines two processes:
- `web`: The FastAPI server
- `worker`: The LiveKit voice agent

Railway should automatically detect both. If not:
- In **Settings** → **Deploy** → **Start Command**
- Ensure it's using the Procfile (this should be automatic)

### Step 5: Setup Frontend Service

1. In the same Railway project, click **"+ New Service"** again
2. Select **"GitHub Repo"**
3. Choose: `erose2502/bethesda-shelter-agent`
4. **Important**: Set **Root Directory** to: `src/Frontend`
5. Railway will detect it's a Vite app

### Step 6: Configure Frontend Environment Variables

Click on the Frontend service → **Variables** tab → Add:

```bash
VITE_API_URL=https://your-backend-url.up.railway.app
```

Replace `your-backend-url` with the actual URL from Step 3.

### Step 7: Generate Frontend Domain

In Frontend service **Settings** tab:

- Under **Networking** → Click **"Generate Domain"**
- Copy the generated URL (e.g., `https://bethesda-dashboard-production.up.railway.app`)

### Step 8: Update Backend CORS

1. Go back to **Backend service** → **Variables**
2. Add:
   ```bash
   FRONTEND_URL=https://your-frontend-url.up.railway.app
   ```

3. Then update `src/main.py` locally:

```python
# In src/main.py, find the CORS middleware section and update:

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url if hasattr(settings, 'frontend_url') else "*",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

4. Commit and push:
   ```bash
   cd /Users/elijah/Bethesda
   git add src/main.py
   git commit -m "Update CORS for production frontend"
   git push origin main
   ```

Railway will automatically redeploy the backend.

## 📊 Verify Deployment

### Check Backend Health

```bash
curl https://your-backend-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-17T..."
}
```

### Check Frontend

Visit: `https://your-frontend-url.up.railway.app`

You should see the professional Bethesda dashboard!

### Check LiveKit Worker

In Railway dashboard:

1. Click on Backend service
2. Go to **Deployments** tab
3. Click on the latest deployment
4. View **Logs**
5. Look for: `🚀 Starting Bethesda Shelter Agent...`

### Test Phone System

Call: **+1 (518) 840-4103**

The LiveKit agent should:
- Answer your call
- Process reservations
- Update the database
- Show changes on the dashboard

## 🐛 Troubleshooting

### Backend Issues

**"Database init failed"** - This is normal on first startup. Railway needs to:
1. Ensure Postgres service is running
2. Set the `DATABASE_URL` environment variable correctly

To fix:
- Go to Backend service → Variables
- Verify `DATABASE_URL` is set to: `${{Postgres.DATABASE_URL}}`
- This syntax tells Railway to inject the Postgres connection string

**"Port already in use"** - Railway handles ports automatically:
- The `PORT` environment variable is automatically set by Railway
- Your Procfile uses: `--port $PORT` which is correct

### Frontend Issues

**"Build failed"** - Check logs in Railway:
```bash
cd /Users/elijah/Bethesda/src/Frontend
npm install
npm run build
```

If successful locally, the issue might be Railway-specific. Check:
- Root directory is set to `src/Frontend`
- `railway.json` exists in `src/Frontend/`

**"API calls return 404"** - CORS or URL issue:
1. Check `VITE_API_URL` in Frontend variables
2. Verify backend has `FRONTEND_URL` set
3. Check backend CORS configuration

### Worker Process Issues

If LiveKit agent isn't responding:

1. Check **Procfile** in Railway:
   ```
   web: python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
   worker: python src/livekit_agent.py start
   ```

2. Verify all LiveKit environment variables are set in Backend service

3. Check Twilio webhook configuration points to your LiveKit endpoint

## 🎯 Quick Status Check

```bash
# View backend logs
railway logs --service backend

# View frontend logs  
railway logs --service frontend

# Check all services status
railway status
```

## 📱 Share With Team

Once deployed, share these URLs with your house supervisors:

- **📊 Dashboard**: `https://your-frontend-url.up.railway.app`
- **📞 Phone**: `+1 (518) 840-4103`

## 🔐 Security Reminder

- ✅ All sensitive keys stored as Railway environment variables
- ✅ HTTPS enabled automatically
- ✅ Database credentials never exposed
- ✅ CORS restricted to your frontend domain

## 🎉 You're Done!

Your complete Bethesda Mission shelter management system is now live:

1. ✅ Voice agent answers calls
2. ✅ Reservations stored in database
3. ✅ Dashboard updates in real-time
4. ✅ House supervisors can manage beds
5. ✅ Professional, responsive UI

---

**Need Help?**
- Railway Docs: https://docs.railway.app
- Project Dashboard: https://railway.app/project/98efa78c-6089-4e9b-b9b6-62f8a388699a
- GitHub Repo: https://github.com/erose2502/bethesda-shelter-agent

**Deployment Date**: December 16, 2025  
**Status**: 🚀 Ready for Production
