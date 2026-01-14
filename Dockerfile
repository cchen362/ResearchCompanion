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

# Create app user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Setup directory structure
WORKDIR /app

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy backend from stage 2
COPY --from=backend-builder --chown=appuser:appuser /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=appuser:appuser /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=appuser:appuser /app/backend/package.json ./backend/

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'nginx' >> /app/start.sh && \
    echo 'cd /app/backend && node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port 6767 for the application
EXPOSE 6767

# Run as non-root user
USER appuser

# Set environment variables (these will be overridden by docker-compose or runtime)
ENV NODE_ENV=production
ENV PORT=3001

# Start both nginx and backend
CMD ["/app/start.sh"]