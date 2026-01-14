# Medical Companion PWA - Deployment Guide

## Overview

This guide will help you deploy the Medical Companion PWA on your Debian server using Docker. The application will be accessible on port 6767 with nginx as the reverse proxy.

## Prerequisites

- Debian server with sudo access
- Docker and docker-compose installed
- Port 6767 available
- API keys for:
  - Anthropic Claude
  - OpenAI (for Whisper transcription)
  - Brave Search

## Quick Start

```bash
# 1. Clone or copy the application to your server
git clone <repository-url> medical-companion
cd medical-companion

# 2. Copy environment template
cp .env.docker .env

# 3. Edit .env and add your API keys
nano .env

# 4. Make deployment script executable
chmod +x deploy.sh

# 5. Run deployment
./deploy.sh
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

Edit the `.env` file with your actual API keys:

```bash
# REQUIRED: Your API Keys
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
OPENAI_API_KEY=sk-proj-xxxxx
BRAVE_API_KEY=BSAxxxxx

# REQUIRED: Change this to a secure random string
JWT_SECRET=generate-a-long-random-string-here-use-openssl-rand-base64-32

# Optional: Adjust if needed
NODE_ENV=production
PORT=3001
```

**Security Note**: The JWT_SECRET should be a long, random string. Generate one with:
```bash
openssl rand -base64 32
```

### 3. Build and Deploy

```bash
# Option 1: Use the deployment script
./deploy.sh

# Option 2: Manual deployment
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

- **User accounts**: SQLite database at `/app/data/users.db`
- **Medical data**: Browser IndexedDB (client-side)
- **Backups**: Located in Docker volume `medical-data`

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

### Backup Database

```bash
# Backup user database
docker exec medical-companion cat /app/data/users.db > backup-users-$(date +%Y%m%d).db

# Backup entire data directory
docker run --rm -v medical-companion_medical-data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup-$(date +%Y%m%d).tar.gz /data
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

## Security Checklist

- [ ] Changed JWT_SECRET from default
- [ ] Set strong passwords for user accounts
- [ ] Configured firewall rules
- [ ] Regular backups scheduled
- [ ] HTTPS enabled (recommended)
- [ ] API keys are valid and have appropriate limits

## License

See LICENSE file in the repository root.