# Vercel Clone - Database Schema

This file documents the PostgreSQL database schema for the Vercel Clone project.

## Tables

### projects
- id: UUID (Primary Key)
- name: VARCHAR (255)
- slug: VARCHAR (255) UNIQUE
- gitUrl: VARCHAR (255)
- customDomain: VARCHAR (255) NULLABLE
- status: ENUM (active, archived)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP

### deployments
- id: UUID (Primary Key)
- projectId: UUID (Foreign Key -> projects.id)
- status: ENUM (queued, building, success, failed)
- buildLogs: TEXT
- errorMessage: TEXT NULLABLE
- buildTime: INTEGER (in milliseconds) NULLABLE
- commitSha: VARCHAR (100) NULLABLE
- commitMessage: VARCHAR (255) NULLABLE
- createdAt: TIMESTAMP
- completedAt: TIMESTAMP NULLABLE

### deployment_logs
- id: UUID (Primary Key)
- deploymentId: UUID (Foreign Key -> deployments.id)
- log: TEXT
- timestamp: TIMESTAMP

### custom_domains
- id: UUID (Primary Key)
- projectId: UUID (Foreign Key -> projects.id)
- domain: VARCHAR (255) UNIQUE
- verified: BOOLEAN DEFAULT false
- createdAt: TIMESTAMP

## Indexes
- projects.slug
- deployments.projectId
- deployments.status
- deployments.createdAt DESC
