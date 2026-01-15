# Medical Companion PWA - Production Deployment Guide

## ⚠️ Security Notice

This application handles sensitive medical research data and requires API keys with billing implications. Please follow all security best practices outlined in this document.

## What's New in Version 2.0

- **PostgreSQL Database**: Persistent storage for all user data
- **Multi-Device Sync**: Access from any device with the same login
- **Automatic Backups**: PostgreSQL data is automatically backed up
- **Improved Performance**: Connection pooling and optimized queries
- **Enhanced Security**: JWT authentication with session management

## Overview

This guide will help you deploy the Medical Companion PWA with PostgreSQL database support using Docker. The application will be accessible on port 6767 with nginx as the reverse proxy.

## Prerequisites

- Debian/Ubuntu server with sudo access
- Docker and docker-compose installed
- Ports available: 6767 (app), 5432 (PostgreSQL)
- Minimum 2GB RAM, 10GB disk space
- API keys for:
  - Anthropic Claude
  - OpenAI (for Whisper transcription)
  - Brave Search

## Quick Start with Docker Compose

```bash
# 1. Clone the repository
git clone <repository-url> medical-companion
cd medical-companion

# 2. Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env

# 3. Edit both .env files and add your API keys
nano .env
nano backend/.env

# 4. Deploy with Docker Compose (Production)
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify deployment
docker-compose ps
curl http://localhost:6767/api/health
```

## Detailed Setup

### 1. Install Docker (if not installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install docker-compose
sudo apt install docker-compose -y

# Logout and login again for group changes to take effect
```

### 2. Configure Environment Variables

#### Root `.env` file:
```bash
# Frontend configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_USE_SERVER_STORAGE=true
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

#### Backend `.env` file:
```bash
# 🚨 SECURITY WARNING: NEVER commit this file to version control!
# These are PRODUCTION API keys with real billing implications

# Database (PostgreSQL)
DATABASE_URL=postgresql://meduser:SECURE_PASSWORD_HERE@postgres:5432/medcompanion
USE_POSTGRESQL=true
DB_MAX_CONNECTIONS=50

# Authentication
JWT_SECRET=CHANGE_THIS_TO_YOUR_SECURE_RANDOM_STRING

# API Keys (get from respective dashboards)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
BRAVE_API_KEY=your_brave_search_key_here

# Production settings
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

**Generate secure secrets**:
```bash
# JWT Secret
openssl rand -base64 64

# Database Password
openssl rand -base64 32
```

### 3. Build and Deploy

```bash
# Production deployment with PostgreSQL
docker-compose -f docker-compose.prod.yml up -d --build

# Or use standard docker-compose for development
docker-compose up -d --build
```

### 4. Verify Deployment

Check that services are running:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs -f
```

Test the health endpoint:
```bash
curl http://localhost:6767/api/health
```

## Usage

### Accessing the Application

1. Open your browser and navigate to: `http://your-server-ip:6767`
2. You'll be redirected to the login page
3. Click "Create Account" to register
4. Use email and password (min 6 characters)
5. Share the same login with your spouse if desired

### User Management

- Each user's data is completely isolated
- Users can register with any email address
- The first user to register gets all existing data (if any)
- Subsequent users start with empty data

### Data Storage

- **PostgreSQL Database**: All user data, findings, and research at `postgres_data` volume
- **IndexedDB Cache**: Browser-side cache for offline access
- **Session Storage**: JWT tokens in PostgreSQL `user_sessions` table
- **Backups**: PostgreSQL dumps and volume snapshots

## nginx Configuration

The application uses nginx on port 6767 with the following routing:

- `/` - Frontend (React app)
- `/api` - Backend API (Node.js on port 3001)
- Static assets are cached for 30 days
- API requests have 5-minute timeout for AI operations

## Security Features

1. **Authentication**: JWT-based with 30-day expiry
2. **Password Security**: Bcrypt hashing with salt rounds
3. **Data Isolation**: Complete separation between users
4. **API Key Protection**: Keys are baked into Docker image
5. **HTTPS Ready**: Add SSL certificate to nginx config

## Maintenance

### Viewing Logs

```bash
# All logs
docker-compose logs

# Frontend/nginx logs
docker-compose logs medical-companion | grep nginx

# Backend logs
docker-compose logs medical-companion | grep -v nginx

# Follow logs in real-time
docker-compose logs -f
```

### Backup PostgreSQL Database

```bash
# Full database backup
docker exec medcompanion-postgres pg_dump -U meduser medcompanion > backup-$(date +%Y%m%d-%H%M%S).sql

# Compressed backup
docker exec medcompanion-postgres pg_dump -U meduser -Fc medcompanion > backup-$(date +%Y%m%d).dump

# Backup specific tables
docker exec medcompanion-postgres pg_dump -U meduser -t findings -t digests medcompanion > findings-backup.sql

# Automated daily backups (add to crontab)
0 2 * * * docker exec medcompanion-postgres pg_dump -U meduser medcompanion | gzip > /backups/medcompanion-$(date +\%Y\%m\%d).sql.gz
```

### Restore Database

```bash
# Restore from SQL backup
docker exec -i medcompanion-postgres psql -U meduser medcompanion < backup.sql

# Restore from compressed backup
docker exec -i medcompanion-postgres pg_restore -U meduser -d medcompanion < backup.dump
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Reset Application

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (DELETES ALL DATA!)
docker-compose down -v

# Start fresh
docker-compose up -d --build
```

## Troubleshooting

### Port 6767 Already in Use

```bash
# Check what's using the port
sudo lsof -i :6767

# Change port in docker-compose.yml if needed
ports:
  - "8080:6767"  # Change 8080 to your desired port
```

### Cannot Connect to Application

1. Check firewall rules:
```bash
sudo ufw status
sudo ufw allow 6767
```

2. Verify services are running:
```bash
docker-compose ps
curl http://localhost:6767/api/health
```

3. Check logs for errors:
```bash
docker-compose logs --tail=50
```

### Authentication Issues

1. Verify JWT_SECRET is set correctly
2. Clear browser cookies and localStorage
3. Check backend logs for auth errors

### Database Permission Issues

```bash
# Fix permissions
docker exec medical-companion chown -R appuser:appuser /app/data
```

## Advanced Configuration

### Adding HTTPS/SSL

1. Obtain SSL certificate (e.g., Let's Encrypt)
2. Update nginx.conf to include SSL configuration
3. Update docker-compose.yml to expose port 443
4. Mount certificate files as volumes

### Custom Domain

1. Point your domain to server IP
2. Update nginx.conf server_name
3. Update CORS settings in backend

### Resource Limits

Adjust in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '4'      # Increase for better performance
      memory: 4G     # Increase for larger datasets
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Verify environment variables in `.env`
3. Ensure all API keys are valid
4. Check disk space: `df -h`

## Production Deployment Checklist

### Pre-Deployment
- [ ] Generate secure JWT_SECRET (64+ characters)
- [ ] Generate secure database password
- [ ] Obtain production API keys with appropriate limits
- [ ] Configure domain name and SSL certificates
- [ ] Set up backup storage location
- [ ] Review firewall rules (ports 6767, 5432)

### Deployment
- [ ] Use docker-compose.prod.yml for production
- [ ] Set NODE_ENV=production
- [ ] Configure CORS for production domain
- [ ] Enable PostgreSQL SSL mode
- [ ] Set appropriate resource limits in Docker
- [ ] Configure log rotation

### Post-Deployment
- [ ] Verify all services are running
- [ ] Test user registration and login
- [ ] Verify API integrations work
- [ ] Set up automated backups (cron)
- [ ] Configure monitoring/alerting
- [ ] Test backup and restore procedures
- [ ] Document admin procedures

### Security Checklist
- [ ] Changed all default passwords
- [ ] JWT_SECRET is unique and secure
- [ ] Database password is strong
- [ ] HTTPS/SSL enabled
- [ ] Firewall configured properly
- [ ] API keys have spending limits
- [ ] Regular security updates scheduled
- [ ] Access logs monitored

## Security Best Practices

### API Key Management

1. **Never commit API keys to version control**
   - Use `.env` files (already gitignored)
   - Store production keys securely
   - Rotate keys regularly

2. **Use environment-specific keys**
   - Development keys separate from production
   - Set spending limits on all API keys
   - Monitor usage regularly

3. **Secure the server**
   - Keep Docker and system packages updated
   - Use HTTPS in production (required for PWA features)
   - Implement rate limiting if exposed to internet
   - Regular security audits

### Data Protection

1. **User data is stored locally**
   - All medical research data stays in browser IndexedDB
   - Backend only processes requests, doesn't store health data
   - User database only contains authentication info

2. **Backup considerations**
   - Backend database contains only user accounts
   - Users should export their research data regularly
   - No automatic cloud sync (privacy by design)

## License

See LICENSE file in the repository root.