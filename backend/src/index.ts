import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import routes
import searchRoutes from './routes/search.js';
import transcribeRoute from './routes/transcribe.js';
import digestRoutes from './routes/digest.routes.js';
import agentRoute from './routes/agent.js';
import chatRoutes from './routes/chat.routes.js';
import authRoutes from './routes/auth.routes.js';
import topicsRoutes from './routes/topics.routes.js';
import findingsRoutes from './routes/findings.routes.js';
// New CRUD routes for server storage
import agentsRoutes from './routes/agents.routes.js';
import digestsCrudRoutes from './routes/digests.crud.routes.js';
import chatsRoutes from './routes/chats.routes.js';
// Voice recording and timeline routes
import timelineRoutes from './routes/timeline.routes.js';
import audioRoutes from './routes/audio.routes.js';
import versionRoutes from './routes/version.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import createDigestQueueRouter from './routes/digestQueue.routes.js';

// Import middleware and database
import { authenticate } from './middleware/auth.js';
import { userDatabase } from './database/users.db.js';
import { testConnection, pool } from './db/database.js';

// Import scheduler for autonomous agents
import { schedulerService } from './services/scheduler.service.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize databases on startup
const initializeDatabases = async () => {
  try {
    // Initialize PostgreSQL connection
    const pgConnected = await testConnection();
    if (!pgConnected) {
      console.error('⚠️ PostgreSQL connection failed - some features may not work');
    }

    // Initialize legacy user database (for backward compatibility)
    await userDatabase.initialize();
  } catch (error) {
    console.error('Failed to initialize databases:', error);
  }
};

initializeDatabases();

// Configure server timeout for long-running AI operations (5 minutes)
app.set('timeout', 300000); // 5 minutes in milliseconds

// Middleware - CORS configuration
const allowedOrigins = [
  'http://localhost:6767',
  'http://localhost:3000',
  'http://localhost:5173'
];

// Add production URL from environment if configured
if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

// Parse CORS_ALLOWED_ORIGINS environment variable (comma-separated list)
if (process.env.CORS_ALLOWED_ORIGINS) {
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...corsOrigins);
}

// Remove duplicates and log configured origins for debugging
const uniqueOrigins = [...new Set(allowedOrigins)];
console.log('📍 CORS Allowed Origins:', uniqueOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Allow localhost in development
    if (origin.startsWith('http://localhost:')) {
      callback(null, true);
      return;
    }
    // Allow configured origins (use uniqueOrigins which has all sources)
    if (uniqueOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// Version endpoint (no authentication required)
app.use('/api', versionRoutes);

// Protected routes (authentication required)
app.use('/api', authenticate, searchRoutes);
app.use('/api', authenticate, transcribeRoute);
app.use('/api/digest', authenticate, digestRoutes);
app.use('/api', authenticate, agentRoute);
app.use('/api/chat', authenticate, chatRoutes);
app.use('/api', authenticate, topicsRoutes);
app.use('/api', authenticate, findingsRoutes);
// New CRUD routes for server storage
app.use('/api', authenticate, agentsRoutes);
app.use('/api', authenticate, digestsCrudRoutes);
app.use('/api', authenticate, chatsRoutes);
// Voice recording and timeline routes
app.use('/api', authenticate, timelineRoutes);
app.use('/api', authenticate, audioRoutes);
// Notifications routes (SSE endpoint needs special handling)
app.use('/api', authenticate, notificationsRoutes);
// Digest queue routes for server-side queue management (requires authentication)
app.use('/api/digest-queue', authenticate, createDigestQueueRouter(pool));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log('🔐 Authentication enabled - all API routes require login');

  // Start autonomous agent scheduler
  console.log('🤖 Starting autonomous agent scheduler...');
  schedulerService.start();
  console.log('✅ Autonomous agents will run on their configured schedules');

  // Start background digest processor
  import('./services/digest-processor.service.js').then((module) => {
    const { DigestProcessorService } = module;
    const digestProcessor = new DigestProcessorService(pool);
    digestProcessor.start();
    console.log('🔄 Background digest processor started');
  }).catch(err => {
    console.error('⚠️ Failed to start digest processor:', err);
  });

  // Clean up stale digest queue items on startup
  console.log('🧹 Cleaning up stale digest queue items...');
  import('./services/digestQueue.service.pg.js').then(async (module) => {
    try {
      const DigestQueueServicePG = module.default;
      const queueService = new DigestQueueServicePG(pool);
      const cleanupCount = await queueService.cleanupStaleItems();
      console.log(`✅ Cleaned up ${cleanupCount} stale digest queue items`);
    } catch (cleanupError) {
      console.error('⚠️ Failed to clean up stale queue items:', cleanupError);
      // Non-critical error - continue startup
    }
  }).catch(err => {
    console.error('⚠️ Failed to load digest queue service:', err);
  });
  console.log('\n📡 Auth endpoints (no token required):');
  console.log('  - POST /api/auth/register');
  console.log('  - POST /api/auth/login');
  console.log('  - GET /api/auth/verify');
  console.log('\n🔒 Protected API endpoints (token required):');
  console.log('  - POST /api/parse-search-query');
  console.log('  - POST /api/websearch');
  console.log('  - POST /api/pubmed-search');
  console.log('  - POST /api/summarize');
  console.log('  - POST /api/transcribe');
  console.log('  - POST /api/generate-digest (⏱️ 30-90s for AI processing)');
  console.log('  - POST /api/simplify-digest');
  console.log('  - POST /api/run-agent');
  console.log('  - POST /api/chat/complete');
  console.log('  - POST /api/chat/stream (Server-Sent Events)');
  console.log('  - POST /api/chat/generate-title');
  console.log('  - POST /api/chat/suggestions');
  console.log('\n⚙️ Server timeout: 5 minutes (for long AI operations)');
});

// Set timeout for the HTTP server (5 minutes)
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 310000; // Slightly longer than timeout
server.headersTimeout = 320000; // Even longer to prevent premature closing

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('\n🛑 Shutting down server...');

  // Stop the scheduler
  console.log('🤖 Stopping autonomous agent scheduler...');
  schedulerService.stop();

  // Close the server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);