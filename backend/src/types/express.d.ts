import { Express } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId?: string; // For backward compatibility
        email: string;
        name?: string;
      };
      token?: string;
    }
  }
}