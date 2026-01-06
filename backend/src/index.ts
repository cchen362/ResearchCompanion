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

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow all localhost ports for development
app.use(cors({
  origin: (origin, callback) => {
    // Allow all localhost origins in development
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
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

// Routes
app.use('/api', searchRoutes);
app.use('/api', transcribeRoute);
app.use('/api', digestRoutes);
app.use('/api', agentRoute);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log('📡 API endpoints available:');
  console.log('  - POST /api/parse-search-query');
  console.log('  - POST /api/websearch');
  console.log('  - POST /api/pubmed-search');
  console.log('  - POST /api/summarize');
  console.log('  - POST /api/transcribe');
  console.log('  - POST /api/generate-digest');
  console.log('  - POST /api/simplify-digest');
  console.log('  - POST /api/run-agent');
});