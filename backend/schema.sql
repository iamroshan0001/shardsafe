-- ShardSafe PostgreSQL Schema
-- Run this once on your Amazon RDS instance to create all tables
-- Usage: psql "postgresql://shardsafe:PASSWORD@YOUR-RDS-ENDPOINT:5432/postgres" -f schema.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files metadata table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  original_size BIGINT,
  segment_count INTEGER,
  segment_size INTEGER,
  encryption_salt TEXT,
  key_derivation_parameters JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- File segments (encrypted blocks) table
CREATE TABLE IF NOT EXISTS file_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  segment_number INTEGER NOT NULL,
  s3_object_key TEXT NOT NULL,
  encrypted_size BIGINT DEFAULT 0,
  encryption_iv TEXT DEFAULT '',
  checksum TEXT DEFAULT '',
  upload_status TEXT DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ,
  UNIQUE(file_id, segment_number)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_segments_file_id ON file_segments(file_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at DESC);

-- Verify tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
