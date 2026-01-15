# PostgreSQL Data Persistence Setup Guide

## Overview

This guide explains how to set up PostgreSQL for the Medical Companion PWA to enable:
- **Data persistence** across browser sessions (survives clearing browser data)
- **Multi-device sync** (same data on laptop, desktop, and phone)
- **Server-side storage** (data lives on your server, not just in browser)

## Quick Start

### 1. Using Docker (Recommended)

```bash
# Windows
start-with-postgres.bat

# Linux/Mac
./start-with-postgres.sh
```

This script will:
1. Start PostgreSQL in a Docker container
2. Initialize the database schema
3. Build the backend
4. Start the application

### 2. Manual Setup

#### Step 1: Configure Environment Variables

Copy the example environment file:
```bash
cp .env.docker .env
```

Update `.env` with your actual API keys:
```env
# IMPORTANT: Replace with your actual keys
ANTHROPIC_API_KEY=your-actual-anthropic-key
OPENAI_API_KEY=your-actual-openai-key
BRAVE_API_KEY=your-actual-brave-key

# Enable PostgreSQL
USE_POSTGRESQL=true
VITE_USE_SERVER_STORAGE=true
```

#### Step 2: Start PostgreSQL

```bash
docker-compose up -d postgres
```

#### Step 3: Build Backend

```bash
cd backend
npm install
npm run build
cd ..
```

#### Step 4: Start Application

```bash
docker-compose up
```

## Access Points

- **Frontend**: http://localhost:6767
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
  - Database: `medcompanion`
  - User: `meduser`
  - Password: `medpass123` (change in production!)

## Architecture

### Data Flow

```
User Actions (Any Device)
         ↓
    React Frontend
         ↓
    Backend API
         ↓
    PostgreSQL Database
    (Persistent Storage)
```

### Multi-Device Sync

1. **User logs in on Laptop**
   - Creates topic "Diabetes"
   - Data saved to PostgreSQL

2. **User logs in on Phone**
   - Sees "Diabetes" topic immediately
   - Any changes sync to all devices

3. **User clears browser data**
   - Data remains safe in PostgreSQL
   - Restored on next login

## Database Schema

The PostgreSQL database includes tables for:

- **users**: User accounts and authentication
- **topics**: Medical conditions being tracked
- **findings**: Research results from agents
- **digests**: AI-generated summaries
- **timeline_events**: Medical history events
- **audio_recordings**: Doctor visit recordings
- **conversations**: Chat history
- **user_sessions**: Multi-device session management

## Configuration Options

### Backend Configuration

In `backend/.env`:

```env
# Database
USE_POSTGRESQL=true              # Enable PostgreSQL (false uses SQLite)
DATABASE_URL=postgresql://...    # PostgreSQL connection string

# Connection Pool
DB_MAX_CONNECTIONS=20            # Maximum database connections
DB_IDLE_TIMEOUT=30000           # Idle connection timeout (ms)
```

### Frontend Configuration

In `.env` (root directory):

```env
# Storage Mode
VITE_USE_SERVER_STORAGE=true    # Use server storage (PostgreSQL)
                                # Set to false for local-only (IndexedDB)

# API URL
VITE_API_URL=http://localhost:3001
```

## Development vs Production

### Development Mode

- Uses default passwords (fine for local development)
- PostgreSQL accessible on localhost:5432
- No SSL required

### Production Mode

1. **Change all passwords**:
   ```env
   DB_PASSWORD=strong-unique-password
   JWT_SECRET=long-random-secret-key
   ```

2. **Enable SSL**:
   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://user:pass@host:5432/db?ssl=true
   ```

3. **Restrict PostgreSQL access**:
   - Don't expose port 5432 publicly
   - Use firewall rules
   - Enable PostgreSQL SSL

## Switching Storage Modes

### Use Server Storage (PostgreSQL)

```env
# In .env
VITE_USE_SERVER_STORAGE=true
USE_POSTGRESQL=true
```

Benefits:
- ✅ Data persists across browser clears
- ✅ Multi-device sync
- ✅ Centralized backups

### Use Local Storage (IndexedDB)

```env
# In .env
VITE_USE_SERVER_STORAGE=false
USE_POSTGRESQL=false
```

Benefits:
- ✅ Works offline
- ✅ No server required
- ✅ Complete privacy

## Backup and Recovery

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U meduser medcompanion > backup.sql

# With timestamp
docker-compose exec postgres pg_dump -U meduser medcompanion > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
# Restore from backup
docker-compose exec -T postgres psql -U meduser medcompanion < backup.sql
```

### Automated Backups

Add to crontab for daily backups:
```bash
0 2 * * * cd /path/to/app && docker-compose exec -T postgres pg_dump -U meduser medcompanion > /backups/medcompanion_$(date +\%Y\%m\%d).sql
```

## Troubleshooting

### Issue: "Database connection failed"

**Solution**: Check PostgreSQL is running
```bash
docker-compose ps
docker-compose logs postgres
```

### Issue: "Authentication failed"

**Solution**: Verify credentials match in:
- `docker-compose.yml`
- `backend/.env`
- Database initialization

### Issue: "Data not syncing between devices"

**Solution**: Ensure both devices:
1. Use the same user account
2. Have `VITE_USE_SERVER_STORAGE=true`
3. Can reach the backend API

### Issue: "Lost data after update"

**Solution**: Data is in PostgreSQL
```bash
# Connect to database
docker-compose exec postgres psql -U meduser medcompanion

# Check data exists
\dt                     # List tables
SELECT * FROM topics;   # View topics
SELECT * FROM findings; # View findings
```

## Migration from IndexedDB

If you have existing data in IndexedDB:

1. **Export data** (while using local mode):
   - Settings → Export Data → Download All Data

2. **Switch to PostgreSQL**:
   - Set `VITE_USE_SERVER_STORAGE=true`
   - Restart application

3. **Import data**:
   - Settings → Import Data → Upload file

## Security Considerations

### For Healthcare Data

1. **Encryption**: Consider encrypting sensitive fields
2. **Audit Logs**: PostgreSQL logs all access
3. **Backups**: Encrypt backup files
4. **Access Control**: Use strong passwords
5. **Network**: Use SSL/TLS in production

### HIPAA Compliance

If handling real patient data:
- Enable PostgreSQL SSL
- Encrypt data at rest
- Implement audit logging
- Regular security updates
- Business Associate Agreements (if using cloud)

## Performance Tuning

### PostgreSQL Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_findings_user_topic ON findings(user_id, topic_id);
CREATE INDEX idx_findings_created ON findings(created_at DESC);

-- Vacuum and analyze regularly
VACUUM ANALYZE;
```

### Connection Pool Settings

```env
DB_MAX_CONNECTIONS=20     # Increase for more concurrent users
DB_IDLE_TIMEOUT=30000    # Decrease to free connections faster
```

## Monitoring

### Check Database Size

```sql
SELECT pg_database_size('medcompanion') / 1024 / 1024 AS size_mb;
```

### Active Connections

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'medcompanion';
```

### Slow Queries

```sql
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Support

For issues or questions:
1. Check the [main README](./README.md)
2. Review [CLAUDE.md](./CLAUDE.md) for development guidelines
3. Check PostgreSQL logs: `docker-compose logs postgres`
4. Check backend logs: `docker-compose logs medical-companion`

---

*Last Updated: January 2025*