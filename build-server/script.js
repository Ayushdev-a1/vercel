const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const Redis = require('ioredis')
const axios = require('axios')

const PROJECT_ID = process.env.PROJECT_ID
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:9000'

const publisher = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
})

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
})

let buildStartTime = Date.now()

function publishLog(log, isError = false) {
    const timestamp = new Date().toISOString()
    const prefix = isError ? '❌' : '✓'
    const formattedLog = `[${timestamp}] ${prefix} ${log}`
    
    console.log(formattedLog)
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log: formattedLog }))
    
    // Store in API server
    if (DEPLOYMENT_ID) {
        axios.post(`${API_SERVER_URL}/deployment/${DEPLOYMENT_ID}/status`, {
            log: formattedLog
        }).catch(err => console.error('Failed to log:', err.message))
    }
}

function updateDeploymentStatus(status, errorMessage = null) {
    if (!DEPLOYMENT_ID) return
    
    axios.post(`${API_SERVER_URL}/deployment/${DEPLOYMENT_ID}/status`, {
        status,
        errorMessage
    }).catch(err => console.error('Failed to update status:', err.message))
}

async function cloneRepository() {
    return new Promise((resolve, reject) => {
        const gitURL = process.env.GIT_REPOSITORY__URL
        const outputDir = path.join(__dirname, 'output')

        // Clean output directory
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true })
        }
        fs.mkdirSync(outputDir)

        publishLog(`Cloning repository: ${gitURL}`)

        const cloneProcess = exec(`git clone ${gitURL} ${outputDir}`, (error, stdout, stderr) => {
            if (error) {
                const errorMsg = `Failed to clone repository: ${error.message}`
                publishLog(errorMsg, true)
                updateDeploymentStatus('failed', errorMsg)
                reject(error)
                return
            }
            publishLog(`Repository cloned successfully`)
            resolve()
        })

        cloneProcess.stdout.on('data', (data) => {
            publishLog(`Git: ${data.toString().trim()}`)
        })

        cloneProcess.stderr.on('data', (data) => {
            publishLog(`Git: ${data.toString().trim()}`, true)
        })
    })
}

async function installDependencies() {
    return new Promise((resolve, reject) => {
        const outputDir = path.join(__dirname, 'output')
        
        publishLog(`Installing dependencies...`)

        const installProcess = exec(`cd ${outputDir} && npm install`, (error, stdout, stderr) => {
            if (error) {
                const errorMsg = `Dependency installation failed: ${error.message}`
                publishLog(errorMsg, true)
                updateDeploymentStatus('failed', errorMsg)
                reject(error)
                return
            }
            publishLog(`Dependencies installed successfully`)
            resolve()
        })

        installProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n')
            lines.forEach(line => {
                if (line.trim()) publishLog(`npm: ${line.trim()}`)
            })
        })

        installProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n')
            lines.forEach(line => {
                if (line.trim()) publishLog(`npm: ${line.trim()}`, true)
            })
        })
    })
}

async function buildProject() {
    return new Promise((resolve, reject) => {
        const outputDir = path.join(__dirname, 'output')
        
        publishLog(`Building project...`)

        const buildProcess = exec(`cd ${outputDir} && npm run build`, (error, stdout, stderr) => {
            if (error) {
                const errorMsg = `Build failed: ${error.message}`
                publishLog(errorMsg, true)
                updateDeploymentStatus('failed', errorMsg)
                reject(error)
                return
            }
            publishLog(`Build completed successfully`)
            resolve()
        })

        buildProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n')
            lines.forEach(line => {
                if (line.trim()) publishLog(`build: ${line.trim()}`)
            })
        })

        buildProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n')
            lines.forEach(line => {
                if (line.trim()) publishLog(`build: ${line.trim()}`, true)
            })
        })
    })
}

async function uploadToS3(distFolderPath) {
    try {
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })
        
        publishLog(`Starting S3 upload (${distFolderContents.length} files)...`)
        
        let uploadedCount = 0

        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file)
            
            if (fs.lstatSync(filePath).isDirectory()) continue

            try {
                const s3Key = `__outputs/${PROJECT_ID}/${file}`
                const fileSize = fs.statSync(filePath).size
                
                const command = new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET || 'vercel-clone-outputs',
                    Key: s3Key,
                    Body: fs.createReadStream(filePath),
                    ContentType: mime.lookup(filePath) || 'application/octet-stream'
                })

                await s3Client.send(command)
                uploadedCount++
                publishLog(`Uploaded ${file} (${(fileSize / 1024).toFixed(2)}KB)`)
            } catch (err) {
                const errorMsg = `Failed to upload ${file}: ${err.message}`
                publishLog(errorMsg, true)
            }
        }

        publishLog(`Completed: ${uploadedCount}/${distFolderContents.length} files uploaded`)
        return true
    } catch (err) {
        const errorMsg = `S3 upload failed: ${err.message}`
        publishLog(errorMsg, true)
        updateDeploymentStatus('failed', errorMsg)
        throw err
    }
}

async function init() {
    try {
        publishLog(`🚀 Build process started`)
        publishLog(`Project ID: ${PROJECT_ID}`)
        publishLog(`Deployment ID: ${DEPLOYMENT_ID}`)

        // Clone repository
        await cloneRepository()

        // Install dependencies
        await installDependencies()

        // Build project
        await buildProject()

        updateDeploymentStatus('uploading')

        // Find dist/build folder
        const outputDir = path.join(__dirname, 'output')
        let distFolderPath = null

        const possibleDirs = ['dist', 'build', '.next/static', 'out']
        for (const dir of possibleDirs) {
            const dirPath = path.join(outputDir, dir)
            if (fs.existsSync(dirPath)) {
                distFolderPath = dirPath
                break
            }
        }

        if (!distFolderPath) {
            const errorMsg = 'No build output found (checked: dist, build, .next/static, out)'
            publishLog(errorMsg, true)
            updateDeploymentStatus('failed', errorMsg)
            return
        }

        publishLog(`Found build output: ${path.relative(outputDir, distFolderPath)}`)

        // Upload to S3
        await uploadToS3(distFolderPath)

        // Mark as success
        const buildTime = Date.now() - buildStartTime
        publishLog(`✅ Deployment successful in ${(buildTime / 1000).toFixed(2)}s`)
        updateDeploymentStatus('success')

        // Cleanup
        setTimeout(() => {
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true })
                console.log('Cleaned up output directory')
            }
        }, 5000)

    } catch (error) {
        const errorMsg = `Build pipeline failed: ${error.message}`
        publishLog(errorMsg, true)
        updateDeploymentStatus('failed', errorMsg)
        console.error('Fatal error:', error)
        process.exit(1)
    } finally {
        // Close connections
        setTimeout(() => {
            publisher.disconnect()
            process.exit(0)
        }, 2000)
    }
}

// Handle process signals
process.on('SIGTERM', () => {
    publishLog('Build process terminated', true)
    process.exit(1)
})

process.on('SIGINT', () => {
    publishLog('Build process interrupted', true)
    process.exit(1)
})

// Start the build
init()