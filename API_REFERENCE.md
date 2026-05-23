# Vercel Clone - API Reference

Complete API documentation for the Vercel Clone backend.

## Base URL
```
http://localhost:9000
```

## Authentication
Currently no authentication. For production, add JWT tokens.

---

## Endpoints

### 1. Create Deployment

**Create a new deployment from a GitHub repository.**

```http
POST /project
Content-Type: application/json
```

**Request Body:**
```json
{
  "gitURL": "https://github.com/username/repository",
  "slug": "my-project",
  "name": "My Project"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| gitURL | string | ✅ Yes | Valid GitHub repository URL |
| slug | string | ❌ No | Project identifier (auto-generated if not provided) |
| name | string | ❌ No | Project display name |

**Response (200):**
```json
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

**Error Response (400):**
```json
{
  "status": "error",
  "message": "Invalid GitHub URL format"
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/project \
  -H "Content-Type: application/json" \
  -d '{
    "gitURL": "https://github.com/vercel/next.js",
    "slug": "nextjs-repo"
  }'
```

---

### 2. Get All Projects

**Retrieve list of all deployed projects.**

```http
GET /projects
```

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Project",
      "slug": "my-project",
      "git_url": "https://github.com/username/repository",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:9000/projects
```

---

### 3. Get Project Details

**Retrieve a specific project with its deployment history.**

```http
GET /project/:projectId
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string | Project UUID |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "project": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Project",
      "slug": "my-project",
      "git_url": "https://github.com/username/repository",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "deployments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "project_id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "success",
        "build_logs": "Build started...",
        "error_message": null,
        "build_time": 45000,
        "commit_sha": "abc123def456",
        "commit_message": "Added new feature",
        "created_at": "2024-01-15T10:30:00Z",
        "completed_at": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "status": "error",
  "message": "Project not found"
}
```

**Example:**
```bash
curl http://localhost:9000/project/550e8400-e29b-41d4-a716-446655440000
```

---

### 4. Get Deployment Details

**Retrieve deployment details including all logs.**

```http
GET /deployment/:deploymentId
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| deploymentId | string | Deployment UUID |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "deployment": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "success",
      "build_logs": "Complete log text...",
      "error_message": null,
      "build_time": 45000,
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:35:00Z"
    },
    "logs": [
      {
        "log": "[2024-01-15T10:30:00Z] ✓ Cloning repository",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      {
        "log": "[2024-01-15T10:30:15Z] ✓ Repository cloned successfully",
        "timestamp": "2024-01-15T10:30:15Z"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "status": "error",
  "message": "Deployment not found"
}
```

**Example:**
```bash
curl http://localhost:9000/deployment/550e8400-e29b-41d4-a716-446655440001
```

---

### 5. Update Deployment Status

**Update deployment status and add logs (called by build server).**

```http
POST /deployment/:deploymentId/status
Content-Type: application/json
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| deploymentId | string | Deployment UUID |

**Request Body:**
```json
{
  "status": "building",
  "log": "Building project...",
  "errorMessage": null
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | ❌ No | One of: queued, building, uploading, success, failed |
| log | string | ❌ No | Log message to append |
| errorMessage | string | ❌ No | Error message if deployment failed |

**Response (200):**
```json
{
  "status": "success"
}
```

**Example:**
```bash
curl -X POST http://localhost:9000/deployment/550e8400-e29b-41d4-a716-446655440001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "log": "Deployment completed!"
  }'
```

---

### 6. Delete Project

**Delete a project and all its deployments.**

```http
DELETE /project/:projectId
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| projectId | string | Project UUID |

**Response (200):**
```json
{
  "status": "success",
  "message": "Project deleted"
}
```

**Error Response (500):**
```json
{
  "status": "error",
  "message": "Error message"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:9000/project/550e8400-e29b-41d4-a716-446655440000
```

---

### 7. Health Check

**Check API server health status.**

```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example:**
```bash
curl http://localhost:9000/health
```

---

## WebSocket Events

### Socket.IO Events

**Base URL:**
```
http://localhost:9002
```

#### Subscribe to Logs

**Emit:**
```javascript
socket.emit('subscribe', 'logs:my-project');
```

**Listen:**
```javascript
socket.on('message', (data) => {
  console.log(data.log);
});
```

**Example:**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:9002');

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('subscribe', 'logs:my-project');
});

socket.on('message', (data) => {
  console.log('New log:', data.log);
});
```

---

## Data Models

### Project
```typescript
interface Project {
  id: string;                  // UUID
  name: string;                // Project display name
  slug: string;                // Unique identifier
  git_url: string;             // GitHub repository URL
  custom_domain?: string;      // Custom domain (optional)
  status: 'active' | 'archived';
  created_at: string;          // ISO timestamp
  updated_at: string;          // ISO timestamp
}
```

### Deployment
```typescript
interface Deployment {
  id: string;                  // UUID
  project_id: string;          // Foreign key to projects
  status: 'queued' | 'building' | 'uploading' | 'success' | 'failed';
  build_logs: string;          // Complete build log
  error_message?: string;      // Error description if failed
  build_time?: number;         // Build duration in milliseconds
  commit_sha?: string;         // Git commit hash
  commit_message?: string;     // Git commit message
  created_at: string;          // ISO timestamp
  completed_at?: string;       // ISO timestamp
}
```

### DeploymentLog
```typescript
interface DeploymentLog {
  id: string;                  // UUID
  deployment_id: string;       // Foreign key to deployments
  log: string;                 // Single log line
  timestamp: string;           // ISO timestamp
}
```

---

## Error Handling

### Error Response Format
```json
{
  "status": "error",
  "message": "Human-readable error message"
}
```

### Common Errors

| Status |       Message       | Cause |
|--------|---------------------|-------|
| 400    | Git URL is required | Missing gitURL parameter |
| 400    | Invalid GitHub URL format | URL doesn't match GitHub pattern |
| 404 | Project not found | ProjectId doesn't exist |
| 404 | Deployment not found | DeploymentId doesn't exist |
| 500 | Database error | Database connection issue |

---

## Rate Limiting

Currently no rate limiting. For production, implement:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/project', limiter);
```

---

## CORS Configuration

Currently allows all origins. For production, configure:
```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT']
}));
```

---

## Pagination

Not yet implemented. Future enhancement:
```bash
GET /projects?page=1&limit=20
```

---

## Filtering

Not yet implemented. Future enhancements:
```bash
GET /projects?status=active
GET /projects?search=my-project
GET /projects?sortBy=created_at&order=desc
```

---

## Request/Response Examples

### Complete Deployment Flow

```bash
# 1. Create deployment
curl -X POST http://localhost:9000/project \
  -H "Content-Type: application/json" \
  -d '{"gitURL": "https://github.com/user/repo"}'

# Response contains: projectSlug, deploymentId

# 2. Poll deployment status
curl http://localhost:9000/deployment/{deploymentId}

# 3. Get full details when complete
curl http://localhost:9000/project/{projectId}
```

---

## Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function deployProject(gitURL) {
  try {
    const response = await axios.post('http://localhost:9000/project', {
      gitURL: gitURL
    });
    return response.data;
  } catch (error) {
    console.error('Deployment failed:', error.response.data);
  }
}

// Usage
deployProject('https://github.com/user/repo');
```

### Python
```python
import requests

def deploy_project(git_url):
    response = requests.post('http://localhost:9000/project', json={
        'gitURL': git_url
    })
    return response.json()

# Usage
deploy_project('https://github.com/user/repo')
```

### TypeScript
```typescript
interface DeployResponse {
  status: string;
  data: {
    projectSlug: string;
    projectId: string;
    deploymentId: string;
    url: string;
  };
}

async function deployProject(gitURL: string): Promise<DeployResponse> {
  const response = await fetch('http://localhost:9000/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gitURL })
  });
  return response.json();
}
```

---

## Webhooks (Future)

Planned feature to support GitHub webhooks for automatic redeployment on push:

```bash
POST /webhooks/github
X-GitHub-Event: push
X-Hub-Signature: sha256=...

{
  "repository": {
    "name": "my-repo",
    "full_name": "user/my-repo"
  },
  "ref": "refs/heads/main"
}
```

---

## API Versioning (Future)

Plan to support API versions:
```bash
GET /v1/projects
GET /v2/projects
```

---

## Testing

### Using Postman
1. Import the API endpoints
2. Set variables: `{{base_url}}` = `http://localhost:9000`
3. Create requests for each endpoint
4. Save as collection

### Using cURL
See examples above in each endpoint section.

### Using Swagger/OpenAPI (Future)
```yaml
openapi: 3.0.0
info:
  title: Vercel Clone API
  version: 1.0.0
paths:
  /project:
    post:
      summary: Create deployment
      # ...
```

---

## Monitoring & Analytics

Available metrics:
- Total projects
- Total deployments
- Success rate
- Average build time
- Error rate

Future analytics endpoint:
```bash
GET /analytics
GET /analytics/deployments?period=24h
```

---

**For more details, see COMPLETE_SETUP.md and FEATURES.md**
