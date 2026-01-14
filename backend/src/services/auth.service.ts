import jsonwebtoken from 'jsonwebtoken';
import { userDatabase, UserRegistration, UserLogin } from '../database/users.db.js';
import { authConfig } from '../config/auth.config.js';

const jwt = jsonwebtoken;

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

class AuthService {
  generateToken(payload: JWTPayload): string {
    const tokenPayload = { ...payload };
    return jwt.sign(
      tokenPayload,
      authConfig.jwt.secret,
      { expiresIn: authConfig.jwt.expiresIn } as any
    );
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, authConfig.jwt.secret) as JWTPayload;
      return payload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  async register(registration: UserRegistration): Promise<AuthResponse> {
    // Validate input
    if (!registration.email || !registration.password) {
      throw new Error('Email and password are required');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registration.email)) {
      throw new Error('Invalid email format');
    }

    // Password validation (minimum 6 characters)
    if (registration.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Create user in database
    const user = await userDatabase.createUser(registration);

    // Generate JWT token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });

    return {
      token,
      user,
    };
  }

  async login(credentials: UserLogin): Promise<AuthResponse> {
    // Validate input
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    // Verify user credentials
    const user = await userDatabase.verifyUser(credentials);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });

    return {
      token,
      user,
    };
  }

  async verifyTokenAndGetUser(token: string): Promise<{ id: string; email: string } | null> {
    const payload = this.verifyToken(token);

    if (!payload) {
      return null;
    }

    // Get user from database to ensure they still exist
    const user = await userDatabase.getUserById(payload.userId);

    return user;
  }
}

export const authService = new AuthService();