import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

async function runMigration() {
  if (!config.databaseUrl) {
    console.log('[Migration] No DATABASE_URL provided. Skipping PostgreSQL migration.');
    return;
  }

  const isRDS = config.databaseUrl.includes('rds.amazonaws.com');
  console.log(`[Migration] Connecting to ${isRDS ? 'Amazon RDS PostgreSQL' : 'PostgreSQL'}...`);

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: isRDS ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('[Migration] Executing schema.sql...');
    await pool.query(sql);
    console.log('[Migration] Successfully applied tables, indexes and constraints!');
  } catch (err: any) {
    console.error('[Migration] Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if directly executed
runMigration();
