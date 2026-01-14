import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// User interface
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

// User registration input
export interface UserRegistration {
  email: string;
  password: string;
}

// User login input
export interface UserLogin {
  email: string;
  password: string;
}

class UserDatabase {
  private db: Database | null = null;

  async initialize(): Promise<void> {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), 'data');
      const fs = await import('fs');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Open database connection
      this.db = await open({
        filename: path.join(dataDir, 'users.db'),
        driver: sqlite3.Database
      });

      // Create users table if it doesn't exist
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('✅ User database initialized');
    } catch (error) {
      console.error('Failed to initialize user database:', error);
      throw error;
    }
  }

  async createUser(registration: UserRegistration): Promise<{ id: string; email: string }> {
    if (!this.db) throw new Error('Database not initialized');

    const { email, password } = registration;

    // Check if user already exists
    const existingUser = await this.db.get(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    await this.db.run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, email.toLowerCase(), passwordHash]
    );

    console.log(`✅ User created: ${email}`);
    return { id: userId, email: email.toLowerCase() };
  }

  async verifyUser(login: UserLogin): Promise<{ id: string; email: string } | null> {
    if (!this.db) throw new Error('Database not initialized');

    const { email, password } = login;

    // Get user by email
    const user = await this.db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      return null;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    return { id: user.id, email: user.email };
  }

  async getUserById(userId: string): Promise<{ id: string; email: string } | null> {
    if (!this.db) throw new Error('Database not initialized');

    const user = await this.db.get<User>(
      'SELECT id, email FROM users WHERE id = ?',
      [userId]
    );

    return user ? { id: user.id, email: user.email } : null;
  }

  async getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    if (!this.db) throw new Error('Database not initialized');

    const user = await this.db.get<User>(
      'SELECT id, email FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    return user ? { id: user.id, email: user.email } : null;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const userDatabase = new UserDatabase();