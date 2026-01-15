import dotenv from 'dotenv';

dotenv.config();

export const databaseConfig = {
  // Feature flag to enable PostgreSQL (set to 'true' to use PostgreSQL)
  usePostgreSQL: process.env.USE_POSTGRESQL === 'true' || false,

  postgresql: {
    connectionString: process.env.DATABASE_URL || 'postgresql://meduser:medpass123@localhost:5432/medcompanion',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  },

  // Legacy SQLite configuration (for backward compatibility)
  sqlite: {
    path: process.env.SQLITE_DB_PATH || './data/users.db',
  }
};

// Helper to determine which auth service to use
export function getAuthServiceModule() {
  if (databaseConfig.usePostgreSQL) {
    return '../services/auth.service.pg.js';
  }
  return '../services/auth.service.js';
}

// Helper to determine which auth middleware to use
export function getAuthMiddlewareModule() {
  if (databaseConfig.usePostgreSQL) {
    return '../middleware/auth.pg.js';
  }
  return '../middleware/auth.js';
}