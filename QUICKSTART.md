# 🚀 Quick Start Guide - Vercel Clone

Get your Vercel clone running in **10 minutes**!

## Prerequisites Check
```bash
node --version        # Should be v18+
npm --version         # Should be 9+
psql --version        # Should be 12+
redis-cli --version   # Should be 6+
docker --version      # Should be installed
```

## 1️⃣ Install Dependencies (2 min)

```bash
cd api-server && npm install && cd ..
cd build-server && npm install && cd ..
cd frontend-nextjs && npm install && cd ..
cd s3-reverse-proxy && npm install && cd ..
```

## 2️⃣ Setup Database (2 min)

```bash
# Create database
createdb vercel_clone

# Or with Docker:
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
```

## 3️⃣ Start Redis (1 min)

```bash
# Using Homebrew
brew services start redis

# Or with Docker:
docker run -d --name redis -p 6379:6379 redis:7
```

## 4️⃣ Configure .env Files (2 min)

### api-server/.env
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=vercel_clone
REDIS_HOST=localhost
REDIS_PORT=6379
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
ECS_CLUSTER=vercel-cluster
ECS_TASK=vercel-builder
PREVIEW_DOMAIN=localhost:8000
```

### build-server/.env
```env
REDIS_HOST=localhost
REDIS_PORT=6379
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
S3_BUCKET=vercel-clone-outputs
API_SERVER_URL=http://localhost:9000
```

### frontend-nextjs/.env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:9000
NEXT_PUBLIC_SOCKET_URL=http://localhost:9002
```

## 5️⃣ Open 5 Terminal Windows (3 min)

### Terminal 1: API Server
```bash
cd api-server
npm start
# Should see: ✅ API Server running on port 9000
```

### Terminal 2: Frontend
```bash
cd frontend-nextjs
npm run dev
# Should see: ▲ Next.js running on http://localhost:3000
```

### Terminal 3: S3 Reverse Proxy
```bash
cd s3-reverse-proxy
npm start
# Should see: Reverse Proxy Running on Port 8000
```

### Terminal 4 & 5: Keep as backups

---

## ✅ Everything Running!

Visit: **http://localhost:3000**

## 🎯 Test It Out

### Step 1: Click "Deploy" Tab

### Step 2: Enter a GitHub URL
```
https://github.com/vercel/next.js
```

### Step 3: Click Deploy

### Step 4: Watch Real-time Logs

### Step 5: See Deployment Complete

---

## 🐛 Quick Troubleshooting

### Port Already in Use
```bash
# Kill process on port 9000
lsof -ti :9000 | xargs kill -9

# Or change port in code
```

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# Or restart
brew services restart postgresql
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

### No Logs Appearing
```bash
# Check WebSocket connection
# Open browser DevTools → Console
# Should see Socket.IO connected message
```

---

## 📁 Project Structure

```
vercel/
├── api-server/          (Express + Node)
├── build-server/        (Docker container)
├── frontend-nextjs/     (Next.js + React)
├── s3-reverse-proxy/    (Reverse proxy)
├── COMPLETE_SETUP.md    (Full guide)
├── FEATURES.md          (Feature list)
└── docker-compose.yml   (For production)
```

---

## 🚀 Next Steps

1. **Customize**: Edit frontend colors in `frontend-nextjs/app/page.tsx`
2. **Configure AWS**: Add real AWS credentials for ECS/S3
3. **Deploy**: Use docker-compose or AWS deployment guide
4. **Extend**: Add webhooks, custom domains, analytics

---

## 📚 Key Files

- **Frontend**: `frontend-nextjs/app/page.tsx`
- **API**: `api-server/index.js`
- **Build**: `build-server/script.js`
- **Proxy**: `s3-reverse-proxy/index.js`

---

## 🔗 Useful URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Health | http://localhost:9000/health |
| S3 Proxy | http://localhost:8000 |
| Socket.IO | http://localhost:9002 |

---

## ❓ Still Need Help?

1. Read **COMPLETE_SETUP.md** for detailed instructions
2. Check **FEATURES.md** for what's implemented
3. Look at **API endpoints** in COMPLETE_SETUP.md
4. Review **logs** in terminal windows

---

**You're all set! Happy deploying! 🎉**
