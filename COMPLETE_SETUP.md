# Vercel Clone - Complete Setup Guide

## 🎯 Project Overview

This is a **fully functional Vercel clone** with all critical features:

✅ **Deploy GitHub projects** instantly
✅ **Real-time build logs** via WebSocket
✅ **Track deployment status** (queued, building, success, failed)
✅ **Display error messages** with full error context
✅ **Project management** - list, delete, redeploy
✅ **Deployment history** - complete audit trail
✅ **Database persistence** - PostgreSQL
✅ **Real-time updates** - Redis pub/sub + Socket.IO
✅ **AWS Integration** - ECS for builds, S3 for artifacts
✅ **Subdomain routing** - serve projects via subdomains

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────┐
│         Frontend: Next.js + React            │
│  - Deploy Form  - Projects List             │
│  - Live Logs    - Deployment History        │
└────────────┬─────────────────────────────────┘
             │ HTTP + WebSocket (port 3000)
┌────────────▼─────────────────────────────────┐
│      API Server: Express + Node              │
│  - REST APIs  - WebSocket Server             │
│  - DB Management  - Deployment Tracking      │
│  (Port 9000, 9002)                           │
└────────────┬─────────────────────────────────┘
             │ ECS Task Launch
┌────────────▼─────────────────────────────────┐
│    Build Server: Docker Container            │
│  - Git Clone  - npm install & build          │
│  - S3 Upload  - Real-time Log Publishing     │
└────────────┬─────────────────────────────────┘
         ┌───┴───┐
    ┌────▼─┐   ┌─▼────┐
    │ S3   │   │Redis │
    │      │   │      │
    └──────┘   └──────┘
         │
    ┌────▼──────────────┐
    │ S3 Reverse Proxy   │
    │ (Port 8000)        │
    │ Serves via domain  │
    └───────────────────┘
```

---

## ⚙️ Prerequisites

### Required Software
- **Node.js** v18+ and npm
- **PostgreSQL** 12+
- **Redis** 6+
- **Docker** (for build-server)
- **Git**

### AWS Prerequisites (for production)
- AWS Account with IAM credentials
- S3 Bucket (e.g., `vercel-clone-outputs`)
- ECS Cluster and Task Definition
- EC2 or Fargate for running tasks

---

## 📥 Installation & Configuration

### Step 1: Install Dependencies

```bash
# API Server
cd api-server
npm install

# Build Server
cd ../build-server
npm install

# Frontend
cd ../frontend-nextjs
npm install

# S3 Reverse Proxy
cd ../s3-reverse-proxy
npm install
```

### Step 2: Database Setup

```bash
# Create PostgreSQL database
createdb vercel_clone

# The API server will auto-create tables on startup
# Tables: projects, deployments, deployment_logs
```

### Step 3: Configure Environment Variables

#### `api-server/.env`
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=vercel_clone

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# ECS Configuration
ECS_CLUSTER=vercel-cluster
ECS_TASK=vercel-builder

# AWS VPC (required for Fargate)
SUBNET_1=subnet-xxxxx
SUBNET_2=subnet-xxxxx
SUBNET_3=subnet-xxxxx
SECURITY_GROUP=sg-xxxxx

# Domain Configuration
PREVIEW_DOMAIN=localhost:8000
```

#### `build-server/.env`
```env
REDIS_HOST=localhost
REDIS_PORT=6379
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET=vercel-clone-outputs
API_SERVER_URL=http://localhost:9000
```

#### `frontend-nextjs/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:9000
NEXT_PUBLIC_SOCKET_URL=http://localhost:9002
```

#### `s3-reverse-proxy/.env`
```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET=vercel-clone-outputs
```

### Step 4: AWS S3 Bucket Setup

Create S3 bucket for storing build artifacts:

```bash
# Create bucket
aws s3 mb s3://vercel-clone-outputs --region ap-south-1

# Make it public (for testing only!)
aws s3api put-bucket-policy --bucket vercel-clone-outputs --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::vercel-clone-outputs/*"
  }]
}'
```

### Step 5: Docker Setup for Build Server

Create `build-server/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY script.js .

# Install system dependencies
RUN apk add --no-cache git

CMD ["node", "script.js"]
```

Build and push to AWS ECR:

```bash
# Build
docker build -t vercel-builder:latest build-server/

# Tag and push to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin your_account_id.dkr.ecr.ap-south-1.amazonaws.com

docker tag vercel-builder:latest your_account_id.dkr.ecr.ap-south-1.amazonaws.com/vercel-builder:latest

docker push your_account_id.dkr.ecr.ap-south-1.amazonaws.com/vercel-builder:latest
```

---

## 🚀 Running the Services

Open **5 terminal windows** and start each service:

### Terminal 1: PostgreSQL
```bash
# Using Homebrew (macOS)
brew services start postgresql

# Or using Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# Verify
psql -U postgres -c "SELECT version();"
```

### Terminal 2: Redis
```bash
# Using Homebrew (macOS)
brew services start redis

# Or using Docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7

# Verify
redis-cli ping
```

### Terminal 3: API Server
```bash
cd api-server
npm start

# Expected output:
# ✅ API Server running on port 9000
# 📚 Database connected to localhost:5432
# 🔌 Redis connected to localhost:6379
```

### Terminal 4: Frontend
```bash
cd frontend-nextjs
npm run dev

# Expected output:
# ▲ Next.js 14.1.0
#   - Local: http://localhost:3000
```

### Terminal 5: S3 Reverse Proxy
```bash
cd s3-reverse-proxy
npm start

# Expected output:
# Reverse Proxy Running on Port 8000
```

**All services running!** 🎉

---

## 💻 Using the Platform

### 1. Deploy a Project

1. Open **http://localhost:3000**
2. Go to **🚀 Deploy** tab
3. Enter GitHub URL (e.g., `https://github.com/username/my-nextjs-app`)
4. Click **Deploy**
5. Watch real-time build logs
6. See deployment status and error messages

### 2. View Projects

1. Go to **📁 Projects** tab
2. See all deployed projects
3. Copy project URL to clipboard
4. Click **Details** to see deployment history
5. Click **Delete** to remove project

### 3. View Deployment History

1. From Projects tab, click **Details** on any project
2. See all past deployments
3. View status, build time, and errors
4. Click **Redeploy** to redeploy a previous version

---

## 🔌 API Endpoints

### Create Deployment
```bash
POST /project
Content-Type: application/json

{
  "gitURL": "https://github.com/user/repo",
  "slug": "optional-slug",
  "name": "Optional Project Name"
}

Response (200):
{
  "status": "queued",
  "data": {
    "projectSlug": "my-project",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "deploymentId": "550e8400-e29b-41d4-a716-446655440001",
    "url": "http://my-project.localhost:8000",
    "previewUrl": "http://my-project.localhost:8000"
  }
}
```

### Get All Projects
```bash
GET /projects

Response (200):
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "name": "My Project",
      "slug": "my-project",
      "git_url": "https://github.com/user/repo",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Project Details
```bash
GET /project/:projectId

Response (200):
{
  "status": "success",
  "data": {
    "project": { /* project object */ },
    "deployments": [
      {
        "id": "uuid",
        "status": "success",
        "build_time": 45000,
        "error_message": null,
        "created_at": "2024-01-15T10:30:00Z",
        "completed_at": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

### Get Deployment Details with Logs
```bash
GET /deployment/:deploymentId

Response (200):
{
  "status": "success",
  "data": {
    "deployment": { /* deployment object */ },
    "logs": [
      {
        "log": "Cloning repository: https://github.com/user/repo",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      {
        "log": "Repository cloned successfully",
        "timestamp": "2024-01-15T10:30:15Z"
      }
    ]
  }
}
```

### Delete Project
```bash
DELETE /project/:projectId

Response (200):
{
  "status": "success",
  "message": "Project deleted"
}
```

### Health Check
```bash
GET /health

Response (200):
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 🐛 Error Handling & Messages

The system gracefully handles all errors:

### GitHub URL Validation
❌ Invalid format: "Enter valid Github Repository URL"
✅ Accepted: `https://github.com/user/repo`

### Clone Failures
❌ Private repo without access
❌ Repository not found
❌ Network timeout

### Build Failures
❌ Missing `package.json`
❌ No `npm run build` script
❌ Dependency resolution failed
❌ TypeScript compilation errors

### S3 Upload Errors
❌ AWS credentials invalid
❌ Bucket not accessible
❌ Insufficient permissions

### Display
- All errors shown in real-time logs
- Error messages stored in database
- Displayed in UI with error badge
- Visible in deployment history

---

## 📊 Database Schema

### projects Table
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255) UNIQUE,
    git_url VARCHAR(255),
    custom_domain VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### deployments Table
```sql
CREATE TABLE deployments (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    status VARCHAR(50) DEFAULT 'queued',
    build_logs TEXT,
    error_message TEXT,
    build_time INTEGER,
    commit_sha VARCHAR(100),
    commit_message VARCHAR(255),
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

### deployment_logs Table
```sql
CREATE TABLE deployment_logs (
    id UUID PRIMARY KEY,
    deployment_id UUID REFERENCES deployments(id),
    log TEXT,
    timestamp TIMESTAMP
);
```

---

## 🎨 Frontend Features

### Deploy Tab
- ✅ GitHub URL validation
- ✅ Real-time build logs with auto-scroll
- ✅ Deployment status indicator
- ✅ Preview URL with copy button
- ✅ Error messages display

### Projects Tab
- ✅ List all projects
- ✅ Copy preview URLs
- ✅ View project details
- ✅ Delete projects with confirmation
- ✅ View deployment count

### History Tab
- ✅ Complete deployment history
- ✅ Status badges (color-coded)
- ✅ Build time display
- ✅ Error messages for failed deployments
- ✅ Redeploy button

### UI Components
- ✅ Dark theme with Tailwind CSS
- ✅ Responsive design
- ✅ Toast notifications
- ✅ Loading states
- ✅ Status indicators

---

## 🚀 Production Deployment

### Option 1: AWS Deployment

1. **API Server**: Deploy to EC2 or ECS
2. **Frontend**: Deploy to Vercel or CloudFront + S3
3. **Database**: Use Amazon RDS (PostgreSQL)
4. **Cache**: Use Amazon ElastiCache (Redis)
5. **Build Server**: Use ECS Fargate for auto-scaling
6. **Storage**: Use S3 with CloudFront CDN

### Option 2: Docker Compose (for testing)

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vercel_clone
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: ./api-server
    ports:
      - "9000:9000"
      - "9002:9002"
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend-nextjs
    ports:
      - "3000:3000"

  proxy:
    build: ./s3-reverse-proxy
    ports:
      - "8000:8000"
```

Run all services:
```bash
docker-compose up
```

---

## 🧪 Testing

### Test GitHub Integration
```bash
# Deploy a simple Next.js app
curl -X POST http://localhost:9000/project \
  -H "Content-Type: application/json" \
  -d '{
    "gitURL": "https://github.com/vercel/next.js",
    "slug": "nextjs-test"
  }'
```

### Test Project Listing
```bash
curl http://localhost:9000/projects
```

### Test Deployment Status
```bash
# Get deployment ID from POST response
curl http://localhost:9000/deployment/{deploymentId}
```

---

## 🔍 Troubleshooting

### Issue: Logs not appearing in UI
**Solution:**
- Check Redis is running: `redis-cli ping` → should return `PONG`
- Check Socket.IO connection in browser console
- Verify WebSocket is not blocked by firewall

### Issue: Build fails with "package.json not found"
**Solution:**
- Ensure the GitHub repository has `package.json` in root
- Check `npm run build` script exists in `package.json`

### Issue: Database connection error
**Solution:**
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# Check database exists
psql -U postgres -l | grep vercel_clone
```

### Issue: S3 upload fails
**Solution:**
- Verify AWS credentials in `.env` files
- Check S3 bucket exists and is accessible
- Verify IAM user has S3 permissions
- Check bucket region matches in code

### Issue: ECS task not starting
**Solution:**
- Verify ECS cluster and task definition exist
- Check IAM roles and permissions
- Verify Docker image is in ECR
- Check CloudWatch logs for task errors

---

## 📚 Key Features Implemented

✅ **URL Validation**: Regex validation for GitHub URLs
✅ **Real-time Logs**: WebSocket/Socket.IO for live updates
✅ **Error Messages**: Comprehensive error handling and display
✅ **Database**: PostgreSQL for persistence
✅ **API Server**: Express with REST endpoints
✅ **Build Process**: npm install → npm run build
✅ **S3 Integration**: Automatic artifact upload
✅ **Status Tracking**: queued → building → success/failed
✅ **Project Management**: CRUD operations
✅ **Deployment History**: Complete audit trail
✅ **Frontend UI**: Next.js with Tailwind CSS
✅ **Socket.IO**: Real-time communication
✅ **Redis Pub/Sub**: Log streaming
✅ **ECS Integration**: Docker container orchestration

---

## 🎯 Next Steps / Future Enhancements

- [ ] GitHub webhooks for auto-deployment
- [ ] Custom domain support
- [ ] Environment variables management
- [ ] Build caching for faster deploys
- [ ] Team collaboration features
- [ ] Deployment analytics and metrics
- [ ] Rollback to previous deployments
- [ ] Custom build scripts
- [ ] Email notifications
- [ ] CI/CD pipeline integration
- [ ] Performance monitoring
- [ ] Deployment status page

---

## 📝 License

MIT License

---

## 🙋 Support

For issues or questions:
1. Check logs: `docker-compose logs -f api`
2. Verify env variables: `printenv | grep DB_`
3. Test connectivity: `telnet localhost 5432`
4. Check database: `psql vercel_clone -c "SELECT * FROM projects;"`

**Happy Deploying!** 🚀
