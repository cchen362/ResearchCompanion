import { query, queryOne, transaction } from '../db/database.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  password_hash?: string; // Exclude from API responses
  name?: string;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  is_active: boolean;
  email_verified: boolean;
  verification_token?: string;
  reset_token?: string;
  reset_token_expires?: Date;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name?: string;
  device_type?: string;
  last_seen: Date;
  created_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_id?: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
  last_activity: Date;
}

export class UserModel {
  // Create a new user
  static async create(email: string, password: string, name?: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    const user = await queryOne<User>(
      `INSERT INTO users (email, password_hash, name, verification_token)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, created_at, updated_at, is_active, email_verified`,
      [email, passwordHash, name, verificationToken]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    return queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    return queryOne<User>(
      'SELECT id, email, name, created_at, updated_at, last_login, is_active, email_verified FROM users WHERE id = $1',
      [id]
    );
  }

  // Verify password
  static async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user || !user.password_hash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Don't return password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  // Update user
  static async update(id: string, updates: Partial<User>): Promise<User | null> {
    const allowedFields = ['name', 'email_verified', 'is_active'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    return queryOne<User>(
      `UPDATE users
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, name, created_at, updated_at, last_login, is_active, email_verified`,
      values
    );
  }

  // Create or update device
  static async upsertDevice(userId: string, deviceId: string, deviceName?: string, deviceType?: string): Promise<UserDevice> {
    const device = await queryOne<UserDevice>(
      `INSERT INTO user_devices (user_id, device_id, device_name, device_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET last_seen = CURRENT_TIMESTAMP, device_name = EXCLUDED.device_name, device_type = EXCLUDED.device_type
       RETURNING *`,
      [userId, deviceId, deviceName, deviceType]
    );

    if (!device) {
      throw new Error('Failed to upsert device');
    }

    return device;
  }

  // Create session
  static async createSession(userId: string, tokenHash: string, deviceId?: string, ipAddress?: string, userAgent?: string): Promise<UserSession> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const session = await queryOne<UserSession>(
      `INSERT INTO user_sessions (user_id, device_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, deviceId, tokenHash, ipAddress, userAgent, expiresAt]
    );

    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  // Find session by token
  static async findSessionByToken(tokenHash: string): Promise<UserSession | null> {
    const session = await queryOne<UserSession>(
      `SELECT * FROM user_sessions
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (session) {
      // Update last activity
      await query(
        'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [session.id]
      );
    }

    return session;
  }

  // Delete session
  static async deleteSession(tokenHash: string): Promise<void> {
    await query(
      'DELETE FROM user_sessions WHERE token_hash = $1',
      [tokenHash]
    );
  }

  // Delete all sessions for a user
  static async deleteAllUserSessions(userId: string): Promise<void> {
    await query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );
  }

  // Get user preferences
  static async getPreferences(userId: string): Promise<any> {
    const prefs = await queryOne(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    // If no preferences exist, create default ones
    if (!prefs) {
      return queryOne(
        `INSERT INTO user_preferences (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );
    }

    return prefs;
  }

  // Update user preferences
  static async updatePreferences(userId: string, preferences: any): Promise<any> {
    return queryOne(
      `INSERT INTO user_preferences (user_id, theme, notifications_enabled, email_notifications,
         auto_generate_digests, digest_frequency, language, timezone, privacy_settings, ui_preferences)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id)
       DO UPDATE SET
         theme = EXCLUDED.theme,
         notifications_enabled = EXCLUDED.notifications_enabled,
         email_notifications = EXCLUDED.email_notifications,
         auto_generate_digests = EXCLUDED.auto_generate_digests,
         digest_frequency = EXCLUDED.digest_frequency,
         language = EXCLUDED.language,
         timezone = EXCLUDED.timezone,
         privacy_settings = EXCLUDED.privacy_settings,
         ui_preferences = EXCLUDED.ui_preferences,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        preferences.theme || 'light',
        preferences.notifications_enabled ?? true,
        preferences.email_notifications ?? false,
        preferences.auto_generate_digests ?? true,
        preferences.digest_frequency || 'weekly',
        preferences.language || 'en',
        preferences.timezone || 'UTC',
        JSON.stringify(preferences.privacy_settings || {}),
        JSON.stringify(preferences.ui_preferences || {})
      ]
    );
  }
}