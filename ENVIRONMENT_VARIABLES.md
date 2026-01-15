# Environment Variables Configuration Guide

This document describes all environment variables used in the Medical Companion PWA.

## Table of Contents
- [Frontend Environment Variables](#frontend-environment-variables)
- [Backend Environment Variables](#backend-environment-variables)
- [Docker Environment Variables](#docker-environment-variables)
- [Production Configuration](#production-configuration)
- [Security Best Practices](#security-best-practices)

## Frontend Environment Variables

Configure these in the root `.env` file:

### API Configuration
```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:3001

# Storage mode configuration
VITE_USE_SERVER_STORAGE=true  # true: Use PostgreSQL, false: Use IndexedDB only

# CORS configuration
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
```

## Backend Environment Variables

Configure these in `backend/.env`:

### Required Variables

#### Database Configuration
```env
# PostgreSQL connection URL
DATABASE_URL=postgresql://meduser:medpass123@localhost:5432/medcompanion

# Enable PostgreSQL (set to false to use SQLite fallback)
USE_POSTGRESQL=true

# Database connection pool settings
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# SQLite fallback (if PostgreSQL is disabled)
DB_PATH=./data/medical-companion.db
```

#### Authentication
```env
# JWT secret for token signing (generate a secure random string)
JWT_SECRET=your-very-secure-jwt-secret-key-here-min-32-chars

# Session configuration
SESSION_EXPIRY_DAYS=30
REFRESH_TOKEN_EXPIRY_DAYS=90
```

#### AI Services
```env
# Anthropic API for Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# OpenAI API for Whisper transcription
OPENAI_API_KEY=sk-...

# Brave Search API for web research
BRAVE_API_KEY=BSA...
```

### Optional Variables

#### Server Configuration
```env
# Server port (default: 3001)
PORT=3001

# Node environment
NODE_ENV=development  # Options: development, production, test

# API rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

#### Medical API Configuration
```env
# PubMed API (no key required, but rate limited)
PUBMED_BASE_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils

# ClinicalTrials.gov API (no key required)
CLINICAL_TRIALS_BASE_URL=https://clinicaltrials.gov/api/v2

# FDA API (no key required, but rate limited)
FDA_BASE_URL=https://api.fda.gov
```

#### Logging and Monitoring
```env
# Log level
LOG_LEVEL=info  # Options: error, warn, info, debug

# Enable detailed SQL logging
LOG_SQL=false

# Enable performance monitoring
ENABLE_MONITORING=true
```

#### Cost Management
```env
# Monthly budget limit in USD
MONTHLY_BUDGET_USD=20

# Cost tracking
TRACK_API_COSTS=true

# Alert threshold (percentage of budget)
BUDGET_ALERT_THRESHOLD=80
```

## Docker Environment Variables

Configure these in `.env.docker` or docker-compose.yml:

### PostgreSQL Container
```env
# PostgreSQL database settings
POSTGRES_DB=medcompanion
POSTGRES_USER=meduser
POSTGRES_PASSWORD=medpass123

# PostgreSQL performance tuning
POSTGRES_MAX_CONNECTIONS=100
POSTGRES_SHARED_BUFFERS=256MB
```

### Application Container
```env
# Container networking
DATABASE_HOST=postgres  # Docker service name
DATABASE_PORT=5432

# Volume mounts
DATA_VOLUME=/app/data
UPLOADS_VOLUME=/app/uploads
```

## Production Configuration

### Required for Production

```env
# Security
NODE_ENV=production
JWT_SECRET=<generate-secure-64-char-string>
SECURE_COOKIES=true
HTTPS_ONLY=true

# Database SSL
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# CORS (specify exact origins)
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Rate limiting (stricter for production)
RATE_LIMIT_MAX_REQUESTS=50
```

### Recommended for Production

```env
# Monitoring
SENTRY_DSN=https://...@sentry.io/...
NEW_RELIC_LICENSE_KEY=...

# Backup configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # 2 AM daily
BACKUP_RETENTION_DAYS=30

# Email notifications (for critical alerts)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG...
ALERT_EMAIL=admin@yourdomain.com
```

## Security Best Practices

### 1. Never Commit Secrets
- Add all `.env` files to `.gitignore`
- Use `.env.example` files with dummy values
- Store production secrets in secure vaults

### 2. Generate Strong Secrets
```bash
# Generate JWT secret
openssl rand -base64 64

# Generate database password
openssl rand -base64 32
```

### 3. Rotate Secrets Regularly
- JWT secrets: Every 90 days
- Database passwords: Every 180 days
- API keys: When employees leave or annually

### 4. Use Environment-Specific Files
```
.env.local       # Local development
.env.test        # Testing
.env.staging     # Staging environment
.env.production  # Production (never commit)
```

### 5. Validate Required Variables
```javascript
// backend/src/config/validate.ts
const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ANTHROPIC_API_KEY'
];

requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

## Environment Variable Priority

Variables are loaded in this order (later overrides earlier):
1. System environment variables
2. `.env` file
3. `.env.local` file (if exists)
4. Command line arguments

## Troubleshooting

### Common Issues

1. **"Missing environment variable" error**
   - Check if the variable is defined in the correct `.env` file
   - Restart the application after adding variables

2. **"Database connection failed"**
   - Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
   - Check if PostgreSQL is running: `docker ps`
   - Test connection: `psql $DATABASE_URL`

3. **"Invalid JWT secret"**
   - Ensure JWT_SECRET is at least 32 characters
   - Use the same secret across all instances

4. **API rate limiting**
   - Check if API keys are correctly set
   - Monitor usage against provider limits
   - Implement caching to reduce API calls

## Example Files

### `.env.example` (Root)
```env
# Frontend configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_USE_SERVER_STORAGE=true
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### `backend/.env.example`
```env
# Database
DATABASE_URL=postgresql://meduser:medpass123@localhost:5432/medcompanion
USE_POSTGRESQL=true

# Authentication
JWT_SECRET=change-this-to-a-secure-secret-key-minimum-32-characters

# AI Services (get your own keys)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
BRAVE_API_KEY=BSA...

# Server
PORT=3001
NODE_ENV=development
```

## Migration from v1.x

If upgrading from IndexedDB-only version:
1. Set `VITE_USE_SERVER_STORAGE=false` initially
2. Export all data from IndexedDB
3. Set up PostgreSQL with `USE_POSTGRESQL=true`
4. Import data to PostgreSQL
5. Set `VITE_USE_SERVER_STORAGE=true`

---

*Last Updated: January 16, 2026*