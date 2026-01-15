import { Request, Response, NextFunction } from 'express';
import { authServicePG } from '../services/auth.service.pg.js';

/**
 * Middleware to authenticate requests using JWT token with PostgreSQL session validation
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token and get user from PostgreSQL
    const user = await authServicePG.verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      userId: user.id, // For backward compatibility
      email: user.email,
      name: user.name,
    };
    req.token = token;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware - allows both authenticated and unauthenticated requests
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await authServicePG.verifyTokenAndGetUser(token);

      if (user) {
        req.user = {
          id: user.id,
          userId: user.id, // For backward compatibility
          email: user.email,
          name: user.name,
        };
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
}