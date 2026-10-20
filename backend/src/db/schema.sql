-- ShardSafe PostgreSQL Schema Definition
-- Compatible with Amazon RDS PostgreSQL and Local PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  original_size BIGINT NOT NULL,
  segment_count INTEGER NOT NULL,
  segment_size INTEGER NOT NULL,
  encryption_salt VARCHAR(255) NOT NULL,
  key_derivation_parameters JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS file_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  segment_number INTEGER NOT NULL,
  s3_object_key VARCHAR(512) NOT NULL,
  encrypted_size BIGINT NOT NULL DEFAULT 0,
  encryption_iv VARCHAR(255) NOT NULL,
  checksum VARCHAR(255) NOT NULL,
  upload_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_file_segment UNIQUE (file_id, segment_number)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  operation VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_segments_file_id ON file_segments(file_id);
CREATE INDEX IF NOT EXISTS idx_segments_status ON file_segments(upload_status);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at DESC);
