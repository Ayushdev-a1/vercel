const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const Redis = require('ioredis')
const { Pool } = require('pg')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const app = express()
const PORT = 9000

// Middleware
app.use(express.json())
app.use(cors())

// Database Configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'vercel_clone'
})

// Redis Setup
const subscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
})

const publisher = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
})

// Socket.IO Setup
const io = new Server({ 
    cors: { origin: '*' },
    transports: ['websocket', 'polling']
})

io.on('connection', socket => {
    console.log('Client connected:', socket.id)
    
    socket.on('subscribe', channel => {
        console.log(`Socket ${socket.id} subscribing to ${channel}`)
        socket.join(channel)
        socket.emit('message', `Subscribed to ${channel}`)
    })

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
    })
})

io.listen(9002, () => console.log('Socket.IO Server running on port 9002'))

// ECS Configuration
const ecsClient = new ECSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
})

const config = {
    CLUSTER: process.env.ECS_CLUSTER || 'vercel-cluster',
    TASK: process.env.ECS_TASK || 'vercel-builder'
}

// Database Initialization
async function initializeDatabase() {
    try {
        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255),
                slug VARCHAR(255) UNIQUE NOT NULL,
                git_url VARCHAR(255) NOT NULL,
                custom_domain VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS deployments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'queued',
                build_logs TEXT DEFAULT '',
                error_message TEXT,
                build_time INTEGER,
                commit_sha VARCHAR(100),
                commit_message VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS deployment_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
                log TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
            CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
            CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
            CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
        `)
        console.log('✅ Database initialized successfully')
    } catch (err) {
        console.error('❌ Database initialization error:', err)
    }
}

// Helper Functions
async function createDeployment(projectId, gitUrl) {
    const deploymentId = uuidv4()
    const startTime = Date.now()
    
    try {
        await pool.query(
            `INSERT INTO deployments (id, project_id, status, created_at) 
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [deploymentId, projectId, 'queued']
        )
        return { deploymentId, startTime }
    } catch (err) {
        console.error('Error creating deployment:', err)
        throw err
    }
}

async function updateDeploymentStatus(deploymentId, status, errorMessage = null) {
    try {
        if (status === 'success' || status === 'failed') {
            await pool.query(
                `UPDATE deployments 
                 SET status = $1, completed_at = CURRENT_TIMESTAMP, error_message = $2
                 WHERE id = $3`,
                [status, errorMessage, deploymentId]
            )
        } else {
            await pool.query(
                `UPDATE deployments SET status = $1 WHERE id = $2`,
                [status, deploymentId]
            )
        }
    } catch (err) {
        console.error('Error updating deployment status:', err)
    }
}

// API Routes

// Create new project deployment
app.post('/project', async (req, res) => {
    try {
        const { gitURL, slug, name } = req.body

        // Validation
        if (!gitURL) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Git URL is required' 
            })
        }

        // Validate GitHub URL format
        const githubRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
        if (!githubRegex.test(gitURL)) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Invalid GitHub URL format' 
            })
        }

        const projectSlug = slug || generateSlug()
        const projectName = name || projectSlug

        // Check if slug already exists
        const existing = await pool.query(
            'SELECT id FROM projects WHERE slug = $1',
            [projectSlug]
        )

        let projectId
        if (existing.rows.length > 0) {
            projectId = existing.rows[0].id
        } else {
            // Create new project
            const projectRes = await pool.query(
                `INSERT INTO projects (name, slug, git_url, created_at, updated_at) 
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING id`,
                [projectName, projectSlug, gitURL]
            )
            projectId = projectRes.rows[0].id
        }

        // Create deployment
        const { deploymentId, startTime } = await createDeployment(projectId, gitURL)

        // Spin up ECS container
        const command = new RunTaskCommand({
            cluster: config.CLUSTER,
            taskDefinition: config.TASK,
            launchType: 'FARGATE',
            count: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    assignPublicIp: 'ENABLED',
                    subnets: [
                        process.env.SUBNET_1 || '',
                        process.env.SUBNET_2 || '',
                        process.env.SUBNET_3 || ''
                    ].filter(Boolean),
                    securityGroups: [process.env.SECURITY_GROUP || '']
                }
            },
            overrides: {
                containerOverrides: [
                    {
                        name: 'builder-image',
                        environment: [
                            { name: 'GIT_REPOSITORY__URL', value: gitURL },
                            { name: 'PROJECT_ID', value: projectSlug },
                            { name: 'DEPLOYMENT_ID', value: deploymentId },
                            { name: 'REDIS_URL', value: process.env.REDIS_URL || 'redis://localhost:6379' }
                        ]
                    }
                ]
            }
        })

        await ecsClient.send(command)
        await updateDeploymentStatus(deploymentId, 'building')

        return res.json({ 
            status: 'queued', 
            data: { 
                projectSlug, 
                projectId,
                deploymentId,
                url: `http://${projectSlug}.localhost:8000`,
                previewUrl: `http://${projectSlug}.${process.env.PREVIEW_DOMAIN || 'localhost:8000'}`
            } 
        })
    } catch (err) {
        console.error('Deploy error:', err)
        return res.status(500).json({ 
            status: 'error', 
            message: err.message 
        })
    }
})

// Get project details
app.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params

        const projectRes = await pool.query(
            'SELECT * FROM projects WHERE id = $1',
            [projectId]
        )

        if (projectRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Project not found' })
        }

        const deploymentsRes = await pool.query(
            `SELECT * FROM deployments 
             WHERE project_id = $1 
             ORDER BY created_at DESC LIMIT 10`,
            [projectId]
        )

        return res.json({
            status: 'success',
            data: {
                project: projectRes.rows[0],
                deployments: deploymentsRes.rows
            }
        })
    } catch (err) {
        console.error('Error getting project:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
})

// Get all projects
app.get('/projects', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, slug, status, created_at FROM projects ORDER BY created_at DESC'
        )
        return res.json({ status: 'success', data: result.rows })
    } catch (err) {
        console.error('Error getting projects:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
})

// Get deployment details with logs
app.get('/deployment/:deploymentId', async (req, res) => {
    try {
        const { deploymentId } = req.params

        const deploymentRes = await pool.query(
            'SELECT * FROM deployments WHERE id = $1',
            [deploymentId]
        )

        if (deploymentRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Deployment not found' })
        }

        const logsRes = await pool.query(
            `SELECT log, timestamp FROM deployment_logs 
             WHERE deployment_id = $1 
             ORDER BY timestamp ASC`,
            [deploymentId]
        )

        return res.json({
            status: 'success',
            data: {
                deployment: deploymentRes.rows[0],
                logs: logsRes.rows
            }
        })
    } catch (err) {
        console.error('Error getting deployment:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
})

// Update deployment status (called by build server)
app.post('/deployment/:deploymentId/status', async (req, res) => {
    try {
        const { deploymentId } = req.params
        const { status, log, errorMessage } = req.body

        if (log) {
            await pool.query(
                `INSERT INTO deployment_logs (deployment_id, log, timestamp) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP)`,
                [deploymentId, log]
            )

            // Emit to socket
            const deploymentRes = await pool.query(
                'SELECT project_id FROM deployments WHERE id = $1',
                [deploymentId]
            )
            if (deploymentRes.rows.length > 0) {
                const projectId = deploymentRes.rows[0].project_id
                const projectRes = await pool.query(
                    'SELECT slug FROM projects WHERE id = $1',
                    [projectId]
                )
                if (projectRes.rows.length > 0) {
                    const slug = projectRes.rows[0].slug
                    publisher.publish(`logs:${slug}`, JSON.stringify({ log }))
                }
            }
        }

        if (status) {
            await updateDeploymentStatus(deploymentId, status, errorMessage)
        }

        return res.json({ status: 'success' })
    } catch (err) {
        console.error('Error updating deployment status:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
})

// Delete project
app.delete('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params

        await pool.query('DELETE FROM projects WHERE id = $1', [projectId])

        return res.json({ status: 'success', message: 'Project deleted' })
    } catch (err) {
        console.error('Error deleting project:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
})

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Initialize and start server
async function start() {
    await initializeDatabase()

    app.listen(PORT, () => {
        console.log(`✅ API Server running on port ${PORT}`)
        console.log(`📚 Database connected to ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`)
        console.log(`🔌 Redis connected to ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`)
    })
}

// Error handling
process.on('error', (err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})

start().catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
})