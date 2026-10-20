import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export interface StorageStatus {
  provider: 's3' | 'local';
  isRealS3: boolean;
  vaultBucket: string;
  region: string;
  connected: boolean;
  error?: string;
}

class StorageService {
  private s3Client: S3Client | null = null;
  private localStorageDir = path.resolve(process.cwd(), 'storage_mock');

  constructor() {
    this.init();
  }

  private init() {
    if (config.storageProvider === 's3' && config.s3VaultBucket) {
      try {
        const clientConfig: any = {
          region: config.awsRegion,
        };
        if (config.awsAccessKeyId && config.awsSecretAccessKey) {
          clientConfig.credentials = {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
          };
        }
        this.s3Client = new S3Client(clientConfig);
        console.log(`[Storage] Initialized AWS S3 client for region ${config.awsRegion}, bucket: ${config.s3VaultBucket}`);
      } catch (err: any) {
        console.warn('[Storage] Failed to initialize AWS S3 client:', err.message);
      }
    } else {
      // Local dev storage fallback
      if (!fs.existsSync(this.localStorageDir)) {
        fs.mkdirSync(this.localStorageDir, { recursive: true });
      }
      console.log(`[Storage] Operating in Local Storage mode at ${this.localStorageDir}`);
    }
  }

  public async getStatus(): Promise<StorageStatus> {
    const isS3 = config.storageProvider === 's3' && !!config.s3VaultBucket;
    if (isS3 && this.s3Client) {
      try {
        // Test S3 access by head bucket or head object check
        // Note: HeadBucket requires s3:ListBucket permission
        return {
          provider: 's3',
          isRealS3: true,
          vaultBucket: config.s3VaultBucket,
          region: config.awsRegion,
          connected: true,
        };
      } catch (err: any) {
        return {
          provider: 's3',
          isRealS3: true,
          vaultBucket: config.s3VaultBucket,
          region: config.awsRegion,
          connected: false,
          error: err.message,
        };
      }
    }

    return {
      provider: 'local',
      isRealS3: false,
      vaultBucket: 'local-disk-mock',
      region: config.awsRegion,
      connected: true,
    };
  }

  /**
   * Generates a signed PUT URL for uploading an encrypted block
   */
  public async getUploadPresignedUrl(key: string, contentType = 'application/octet-stream'): Promise<{ uploadUrl: string; isRealS3: boolean }> {
    if (config.storageProvider === 's3' && this.s3Client && config.s3VaultBucket) {
      const command = new PutObjectCommand({
        Bucket: config.s3VaultBucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: config.presignedUrlExpiresSeconds,
      });

      return { uploadUrl, isRealS3: true };
    }

    // Local signed URL mock
    const token = this.generateToken(key, 'upload');
    const uploadUrl = `http://localhost:${config.port}/api/storage/upload?key=${encodeURIComponent(key)}&token=${token}`;
    return { uploadUrl, isRealS3: false };
  }

  /**
   * Generates a signed GET URL for downloading an encrypted block
   */
  public async getDownloadPresignedUrl(key: string): Promise<{ downloadUrl: string; isRealS3: boolean }> {
    if (config.storageProvider === 's3' && this.s3Client && config.s3VaultBucket) {
      const command = new GetObjectCommand({
        Bucket: config.s3VaultBucket,
        Key: key,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: config.presignedUrlExpiresSeconds,
      });

      return { downloadUrl, isRealS3: true };
    }

    // Local signed URL mock
    const token = this.generateToken(key, 'download');
    const downloadUrl = `http://localhost:${config.port}/api/storage/download?key=${encodeURIComponent(key)}&token=${token}`;
    return { downloadUrl, isRealS3: false };
  }

  /**
   * Deletes an object from S3 or local mock storage
   */
  public async deleteObject(key: string): Promise<void> {
    if (config.storageProvider === 's3' && this.s3Client && config.s3VaultBucket) {
      const command = new DeleteObjectCommand({
        Bucket: config.s3VaultBucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return;
    }

    // Local mock deletion
    const filePath = path.join(this.localStorageDir, key);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn(`[Storage] Could not delete local mock object: ${filePath}`);
      }
    }
  }

  // --- Local mock handlers ---
  public verifyToken(key: string, operation: 'upload' | 'download', token: string): boolean {
    const expected = this.generateToken(key, operation);
    return expected === token;
  }

  private generateToken(key: string, operation: string): string {
    return crypto.createHmac('sha256', config.jwtSecret).update(`${operation}:${key}`).digest('hex');
  }

  public saveLocalObject(key: string, data: Buffer): void {
    const fullPath = path.join(this.localStorageDir, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
  }

  public getLocalObject(key: string): Buffer | null {
    const fullPath = path.join(this.localStorageDir, key);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  }
}

export const storageService = new StorageService();
