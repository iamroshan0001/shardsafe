import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/client.js';
import { config } from '../config/index.js';

export interface UserPayload {
  id: string;
  email: string;
}

export class AuthService {
  public static async register(email: string, password: string):Promise<{ user: UserPayload; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if user already exists
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      throw new Error('A user with this email address already exists');
    }

    // Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const res = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [cleanEmail, passwordHash]
    );

    const user = {
      id: res.rows[0].id,
      email: res.rows[0].email,
    };

    // Log activity
    await db.query(
      'INSERT INTO activity_logs (user_id, operation, status, details) VALUES ($1, $2, $3, $4)',
      [user.id, 'USER_REGISTER', 'success', JSON.stringify({ email: user.email })]
    );

    const token = this.generateToken(user);
    return { user, token };
  }

  public static async login(email: string, password: string): Promise<{ user: UserPayload; token: string }> {
    const cleanEmail = email.trim().toLowerCase();

    const res = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (res.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userRecord = res.rows[0];
    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      await db.query(
        'INSERT INTO activity_logs (user_id, operation, status, details) VALUES ($1, $2, $3, $4)',
        [userRecord.id, 'USER_LOGIN', 'failure', JSON.stringify({ reason: 'Bad credentials' })]
      );
      throw new Error('Invalid email or password');
    }

    const user = {
      id: userRecord.id,
      email: userRecord.email,
    };

    await db.query(
      'INSERT INTO activity_logs (user_id, operation, status, details) VALUES ($1, $2, $3, $4)',
      [user.id, 'USER_LOGIN', 'success', JSON.stringify({ email: user.email })]
    );

    const token = this.generateToken(user);
    return { user, token };
  }

  public static generateToken(user: UserPayload): string {
    return jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  public static verifyToken(token: string): UserPayload {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as UserPayload;
      return decoded;
    } catch (err: any) {
      throw new Error('Invalid or expired authentication token');
    }
  }

  public static async getUserById(id: string): Promise<UserPayload | null> {
    const res = await db.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return {
      id: res.rows[0].id,
      email: res.rows[0].email,
    };
  }
}
