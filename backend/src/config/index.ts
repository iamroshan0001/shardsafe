import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'shardsafe-super-secure-dev-jwt-secret-replace-in-prod-3829104',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // AWS Configuration
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  s3VaultBucket: process.env.S3_VAULT_BUCKET || '',
  s3DocsBucket: process.env.S3_DOCS_BUCKET || '',
  
  // Storage Provider: 's3' or 'local'
  storageProvider: (process.env.STORAGE_PROVIDER || (process.env.S3_VAULT_BUCKET ? 's3' : 'local')) as 's3' | 'local',
  
  // CORS & Security
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  
  // File Vault constraints
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  defaultChunkSizeBytes: parseInt(process.env.CHUNK_SIZE_BYTES || '1048576', 10), // 1 MiB
  
  // Presigned URL expiration (in seconds)
  presignedUrlExpiresSeconds: parseInt(process.env.PRESIGNED_URL_EXPIRES_SECONDS || '900', 10), // 15 minutes
};
