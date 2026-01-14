import express, { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = RegisterSchema.parse(req.body);

    // Register user
    const authResponse = await authService.register(validated);

    // Return token and user info
    res.json({
      success: true,
      token: authResponse.token,
      user: authResponse.user,
    });
  } catch (error: any) {
    console.error('Registration error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    // Handle duplicate email error
    if (error.message?.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = LoginSchema.parse(req.body);

    // Login user
    const authResponse = await authService.login(validated);

    // Return token and user info
    res.json({
      success: true,
      token: authResponse.token,
      user: authResponse.user,
    });
  } catch (error: any) {
    console.error('Login error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    // Handle invalid credentials
    if (error.message?.includes('Invalid email or password')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

// GET /api/auth/verify
router.get('/verify', async (req: Request, res: Response) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token and get user
    const user = await authService.verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Return user info
    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Token verification failed',
    });
  }
});

export default router;