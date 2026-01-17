# Multi-stage build for smaller production image

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY package*.json ./
RUN npm ci

# Copy frontend source
COPY . ./

# Build frontend
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend source
COPY backend/ ./

# Build backend TypeScript
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS production

# Install nginx for serving frontend
RUN apk add --no-cache nginx

# Fix nginx permissions - create temp directories and set ownership
RUN mkdir -p /var/lib/nginx/tmp/client_body \
    /var/lib/nginx/tmp/proxy \
    /var/lib/nginx/tmp/fastcgi \
    /var/lib/nginx/tmp/uwsgi \
    /var/lib/nginx/tmp/scgi \
    /var/log/nginx \
    /run/nginx && \
    chmod -R 777 /var/lib/nginx /var/log/nginx /run/nginx

# Setup directory structure
WORKDIR /app

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy frontend build from stage 1 (will be overwritten by volume mount in dev)
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy backend from stage 2
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/

# Create data directories with proper permissions
RUN mkdir -p /app/data /app/backend/data && \
    chmod -R 777 /app/data /app/backend/data /usr/share/nginx/html

# Create startup script that runs nginx in foreground
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'nginx' >> /app/start.sh && \
    echo 'cd /app/backend && node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 6767 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start both nginx and backend
CMD ["/app/start.sh"]
