import jsonwebtoken from 'jsonwebtoken';
import { UserModel } from '../models/user.model.js';
import { authConfig } from '../config/auth.config.js';
import crypto from 'crypto';

const jwt = jsonwebtoken;

export interface JWTPayload {
  userId: string;
  email: string;
  deviceId?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface UserRegistration {
  email: string;
  password: string;
  name?: string;
}

export interface UserLogin {
  email: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
}

class AuthServicePG {
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(registration.email);
    if (existingUser) {
      throw new Error('An account with this email already exists');
    }

    // Create user in PostgreSQL database
    const user = await UserModel.create(
      registration.email,
      registration.password,
      registration.name
    );

    // Generate device ID if not provided
    const deviceId = crypto.randomBytes(16).toString('hex');

    // Generate JWT token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      deviceId
    });

    // Create session
    const tokenHash = this.hashToken(token);
    await UserModel.createSession(user.id, tokenHash, deviceId);

    // Register device
    await UserModel.upsertDevice(user.id, deviceId, 'Web Browser', 'web');

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async login(credentials: UserLogin): Promise<AuthResponse> {
    // Validate input
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    // Verify user credentials against PostgreSQL
    const user = await UserModel.verifyPassword(credentials.email, credentials.password);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Generate or use provided device ID
    const deviceId = credentials.deviceId || crypto.randomBytes(16).toString('hex');

    // Generate JWT token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      deviceId
    });

    // Create session
    const tokenHash = this.hashToken(token);
    await UserModel.createSession(
      user.id,
      tokenHash,
      deviceId,
      // You can get IP and user agent from request in the route handler
    );

    // Register/update device
    await UserModel.upsertDevice(
      user.id,
      deviceId,
      credentials.deviceName || 'Web Browser',
      credentials.deviceType || 'web'
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async verifyTokenAndGetUser(token: string): Promise<{ id: string; email: string; name?: string } | null> {
    const payload = this.verifyToken(token);

    if (!payload) {
      return null;
    }

    // Verify session is still valid
    const tokenHash = this.hashToken(token);
    const session = await UserModel.findSessionByToken(tokenHash);

    if (!session) {
      return null;
    }

    // Get user from PostgreSQL database
    const user = await UserModel.findById(payload.userId);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }

  async logout(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await UserModel.deleteSession(tokenHash);
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await UserModel.deleteAllUserSessions(userId);
  }
}

// Export singleton instance
export const authServicePG = new AuthServicePG();

// Also export for backward compatibility (will replace old service gradually)
export const authService = authServicePG;