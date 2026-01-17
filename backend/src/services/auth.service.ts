// Re-export PostgreSQL auth service for consistent user storage
// This ensures users are stored in PostgreSQL along with their data (findings, topics, etc.)
export { authServicePG as authService, JWTPayload, AuthResponse, UserRegistration, UserLogin } from './auth.service.pg.js';
