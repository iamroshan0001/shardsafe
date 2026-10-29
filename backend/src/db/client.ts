import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';

const { Pool } = pg;

export interface DbStatus {
  engine: string;
  isRealRDS: boolean;
  connected: boolean;
  error?: string;
  latencyMs?: number;
}

// Memory / Local Store data model
interface LocalStore {
  users: Array<{
    id: string;
    email: string;
    password_hash: string;
    created_at: string;
  }>;
  files: Array<{
    id: string;
    user_id: string;
    original_filename: string;
    mime_type: string;
    original_size: number;
    segment_count: number;
    segment_size: number;
    encryption_salt: string;
    key_derivation_parameters: any;
    status: string;
    created_at: string;
    completed_at?: string;
  }>;
  file_segments: Array<{
    id: string;
    file_id: string;
    segment_number: number;
    s3_object_key: string;
    encrypted_size: number;
    encryption_iv: string;
    checksum: string;
    upload_status: string;
    uploaded_at?: string;
  }>;
  activity_logs: Array<{
    id: string;
    user_id: string;
    file_id?: string;
    operation: string;
    status: string;
    details: any;
    created_at: string;
  }>;
}

const LOCAL_DATA_FILE = path.resolve(process.cwd(), 'dev_data.json');

class DatabaseManager {
  private pool: pg.Pool | null = null;
  private localStore: LocalStore = {
    users: [],
    files: [],
    file_segments: [],
    activity_logs: [],
  };
  private isPostgres = false;
  private isConnected = false;
  private connectionError: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (config.databaseUrl && config.databaseUrl.trim() !== '') {
      try {
        const isRDS = config.databaseUrl.includes('rds.amazonaws.com');
        this.pool = new Pool({
          connectionString: config.databaseUrl,
          ssl: isRDS ? { rejectUnauthorized: false } : undefined,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
          console.error('[PostgreSQL] Unexpected pool error:', err.message);
          this.isConnected = false;
          this.connectionError = err.message;
        });

        this.isPostgres = true;
      } catch (err: any) {
        console.warn('[DB] Failed to initialize PostgreSQL pool:', err.message);
        this.fallbackToLocal();
      }
    } else {
      this.fallbackToLocal();
    }
  }

  private fallbackToLocal() {
    this.isPostgres = false;
    this.isConnected = true;
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      try {
        const data = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
        this.localStore = JSON.parse(data);
      } catch (err) {
        console.warn('[DB] Could not parse local dev_data.json, starting empty');
      }
    }
  }

  private persistLocalStore() {
    if (!this.isPostgres) {
      try {
        fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(this.localStore, null, 2), 'utf-8');
      } catch (err) {
        console.error('[DB] Failed to save dev_data.json:', err);
      }
    }
  }

  public async getStatus(): Promise<DbStatus> {
    const isRDS = !!config.databaseUrl && config.databaseUrl.includes('rds.amazonaws.com');
    if (this.isPostgres && this.pool) {
      const start = Date.now();
      try {
        await this.pool.query('SELECT 1');
        return {
          engine: isRDS ? 'Amazon RDS (PostgreSQL)' : 'Local PostgreSQL',
          isRealRDS: isRDS,
          connected: true,
          latencyMs: Date.now() - start,
        };
      } catch (err: any) {
        return {
          engine: isRDS ? 'Amazon RDS (PostgreSQL)' : 'Local PostgreSQL',
          isRealRDS: isRDS,
          connected: false,
          error: err.message,
        };
      }
    }

    return {
      engine: 'Local Persistent Dev Engine (Pre-RDS Mode)',
      isRealRDS: false,
      connected: true,
      latencyMs: 1,
    };
  }

  public async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount || 0 };
      } catch (err: any) {
        // If connection fails, log error
        console.error('[PostgreSQL] Query failed:', err.message);
        throw err;
      }
    }

    // Emulated query for local mode
    return this.emulateQuery(text, params);
  }

  private emulateQuery(text: string, params: any[]): { rows: any[]; rowCount: number } {
    const normalized = text.trim();
    const upper = normalized.toUpperCase();

    // 1. SELECT * FROM users WHERE email = $1
    if (upper.includes('FROM USERS WHERE EMAIL =') || (upper.includes('FROM USERS') && upper.includes('EMAIL = $1'))) {
      const email = params[0]?.toLowerCase();
      const user = this.localStore.users.find((u) => u.email.toLowerCase() === email);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    // 2. SELECT * FROM users WHERE id = $1
    if (upper.includes('FROM USERS WHERE ID =')) {
      const id = params[0];
      const user = this.localStore.users.find((u) => u.id === id);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    // 3. INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at
    if (upper.startsWith('INSERT INTO USERS')) {
      const id = crypto.randomUUID();
      const email = params[0];
      const password_hash = params[1];
      const created_at = new Date().toISOString();
      const newUser = { id, email, password_hash, created_at };
      this.localStore.users.push(newUser);
      this.persistLocalStore();
      return { rows: [{ id, email, created_at }], rowCount: 1 };
    }

    // 4. INSERT INTO files ...
    if (upper.startsWith('INSERT INTO FILES')) {
      const [
        passedId,
        user_id,
        original_filename,
        mime_type,
        original_size,
        segment_count,
        segment_size,
        encryption_salt,
        key_derivation_parameters,
      ] = params;
      const id = passedId || crypto.randomUUID();

      const newFile = {
        id,
        user_id,
        original_filename,
        mime_type,
        original_size: Number(original_size),
        segment_count: Number(segment_count),
        segment_size: Number(segment_size),
        encryption_salt,
        key_derivation_parameters: typeof key_derivation_parameters === 'string' ? JSON.parse(key_derivation_parameters) : key_derivation_parameters,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      this.localStore.files.push(newFile);
      this.persistLocalStore();
      return { rows: [newFile], rowCount: 1 };
    }

    // 5. INSERT INTO file_segments ...
    if (upper.startsWith('INSERT INTO FILE_SEGMENTS')) {
      const id = crypto.randomUUID();
      const [file_id, segment_number, s3_object_key, encrypted_size, encryption_iv, checksum, upload_status] = params;
      
      const existingIdx = this.localStore.file_segments.findIndex(
        (s) => s.file_id === file_id && s.segment_number === Number(segment_number)
      );

      const segment = {
        id,
        file_id,
        segment_number: Number(segment_number),
        s3_object_key,
        encrypted_size: Number(encrypted_size || 0),
        encryption_iv,
        checksum,
        upload_status: upload_status || 'pending',
        uploaded_at: upload_status === 'uploaded' ? new Date().toISOString() : undefined,
      };

      if (existingIdx >= 0) {
        this.localStore.file_segments[existingIdx] = segment;
      } else {
        this.localStore.file_segments.push(segment);
      }
      this.persistLocalStore();
      return { rows: [segment], rowCount: 1 };
    }

    // 6. UPDATE file_segments (complete part)
    if (upper.startsWith('UPDATE FILE_SEGMENTS')) {
      const [file_id, segment_number, encrypted_size, encryption_iv, checksum] = params;
      const seg = this.localStore.file_segments.find(
        (s) => s.file_id === file_id && s.segment_number === Number(segment_number)
      );
      if (seg) {
        seg.encrypted_size = Number(encrypted_size);
        seg.encryption_iv = encryption_iv;
        seg.checksum = checksum;
        seg.upload_status = 'uploaded';
        seg.uploaded_at = new Date().toISOString();
        this.persistLocalStore();
        return { rows: [seg], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 7. UPDATE files (mark complete or status)
    if (upper.startsWith('UPDATE FILES')) {
      const [status, id] = params;
      const file = this.localStore.files.find((f) => f.id === id);
      if (file) {
        file.status = status;
        file.completed_at = new Date().toISOString();
        this.persistLocalStore();
        return { rows: [file], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 8. SELECT * FROM files WHERE id = $1 AND user_id = $2
    if (upper.includes('FROM FILES WHERE ID = $1 AND USER_ID = $2')) {
      const [id, user_id] = params;
      const file = this.localStore.files.find((f) => f.id === id && f.user_id === user_id);
      return { rows: file ? [{ ...file }] : [], rowCount: file ? 1 : 0 };
    }

    // 9. SELECT * FROM files WHERE id = $1
    if (upper.includes('FROM FILES WHERE ID = $1')) {
      const [id] = params;
      const file = this.localStore.files.find((f) => f.id === id);
      return { rows: file ? [{ ...file }] : [], rowCount: file ? 1 : 0 };
    }

    // 10. SELECT * FROM file_segments WHERE file_id = $1 ORDER BY segment_number ASC
    if (upper.includes('FROM FILE_SEGMENTS WHERE FILE_ID = $1')) {
      const [file_id] = params;
      const segments = this.localStore.file_segments
        .filter((s) => s.file_id === file_id)
        .sort((a, b) => a.segment_number - b.segment_number);
      return { rows: segments.map((s) => ({ ...s })), rowCount: segments.length };
    }

    // 11. SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC
    if (upper.includes('FROM FILES WHERE USER_ID = $1') || upper.includes('FROM FILES WHERE USER_ID = $1 ORDER BY')) {
      const user_id = params[0];
      const files = this.localStore.files
        .filter((f) => f.user_id === user_id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { rows: files.map((f) => ({ ...f })), rowCount: files.length };
    }

    // 12. DELETE FROM files WHERE id = $1 AND user_id = $2
    if (upper.startsWith('DELETE FROM FILES')) {
      const [id, user_id] = params;
      const idx = this.localStore.files.findIndex((f) => f.id === id && f.user_id === user_id);
      if (idx >= 0) {
        this.localStore.files.splice(idx, 1);
        this.localStore.file_segments = this.localStore.file_segments.filter((s) => s.file_id !== id);
        this.persistLocalStore();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 13. INSERT INTO activity_logs
    if (upper.startsWith('INSERT INTO ACTIVITY_LOGS')) {
      const id = crypto.randomUUID();
      const [user_id, file_id, operation, status, details] = params;
      const log = {
        id,
        user_id,
        file_id: file_id || null,
        operation,
        status,
        details: typeof details === 'string' ? JSON.parse(details) : details,
        created_at: new Date().toISOString(),
      };
      this.localStore.activity_logs.unshift(log);
      this.persistLocalStore();
      return { rows: [log], rowCount: 1 };
    }

    // 14. SELECT * FROM activity_logs WHERE user_id = $1
    if (upper.includes('FROM ACTIVITY_LOGS WHERE USER_ID = $1')) {
      const user_id = params[0];
      const logs = this.localStore.activity_logs
        .filter((l) => l.user_id === user_id)
        .slice(0, 50);
      return { rows: logs.map((l) => ({ ...l })), rowCount: logs.length };
    }

    // 15. Stats query (matches the real SQL used by /api/stats)
    if (upper.includes('COUNT(F.ID)') || upper.includes('STATS') || upper.includes('COUNT(F.ID) AS FILE_COUNT')) {
      const user_id = params[0];
      const userFiles = this.localStore.files.filter((f) => f.user_id === user_id && f.status === 'completed');
      const fileIds = new Set(userFiles.map((f) => f.id));
      const segments = this.localStore.file_segments.filter((s) => fileIds.has(s.file_id));
      const totalBytes = userFiles.reduce((acc, f) => acc + (f.original_size || 0), 0);
      const totalEncryptedBytes = segments.reduce((acc, s) => acc + (s.encrypted_size || 0), 0);

      return {
        rows: [
          {
            file_count: userFiles.length,
            segment_count: segments.length,
            total_bytes: totalBytes,
            total_encrypted_bytes: totalEncryptedBytes,
          },
        ],
        rowCount: 1,
      };
    }

    // Fallback: empty rows
    return { rows: [], rowCount: 0 };
  }
}

export const db = new DatabaseManager();
