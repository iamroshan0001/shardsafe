export interface User {
  id: string;
  email: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  latencyMs: number;
  nodeVersion: string;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  services: {
    database: {
      engine: string;
      isRealRDS: boolean;
      connected: boolean;
      latencyMs?: number;
      error?: string;
    };
    storage: {
      provider: 's3' | 'local';
      isRealS3: boolean;
      vaultBucket: string;
      region: string;
      connected: boolean;
      error?: string;
    };
  };
}

export interface FileSegmentMetadata {
  id: string;
  segment_number: number;
  s3_object_key: string;
  encrypted_size: number;
  encryption_iv: string;
  checksum: string;
  upload_status: 'pending' | 'uploaded' | 'failed';
  uploaded_at?: string;
}

export interface VaultFile {
  id: string;
  user_id: string;
  original_filename: string;
  mime_type: string;
  original_size: number;
  segment_count: number;
  segment_size: number;
  encryption_salt: string;
  key_derivation_parameters: {
    algorithm: string;
    iterations: number;
    keyLengthBits: number;
    cipher: string;
  };
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

export interface ActivityLog {
  id: string;
  file_id?: string;
  operation: string;
  status: string;
  details: any;
  created_at: string;
}

export interface DashboardStats {
  fileCount: number;
  segmentCount: number;
  totalBytes: number;
  totalEncryptedBytes: number;
  services: ServiceHealth['services'];
}

const TOKEN_KEY = 'shardsafe_jwt_token';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    return data as T;
  }

  // Health
  public async getHealth(): Promise<ServiceHealth> {
    return this.request<ServiceHealth>('/health');
  }

  // Auth
  public async register(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  // Files
  public async initiateUpload(payload: {
    originalFilename: string;
    mimeType: string;
    originalSize: number;
    segmentCount: number;
    segmentSize: number;
    encryptionSalt: string;
    keyDerivationParameters: any;
  }): Promise<{ file: Partial<VaultFile>; segments: any[] }> {
    return this.request('/files/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getUploadPresignedUrl(
    fileId: string,
    partNumber: number
  ): Promise<{ uploadUrl: string; isRealS3: boolean; s3ObjectKey: string }> {
    return this.request(`/files/${fileId}/parts/${partNumber}/upload-url`, {
      method: 'POST',
    });
  }

  public async completePart(
    fileId: string,
    partNumber: number,
    data: { encryptedSize: number; encryptionIv: string; checksum: string }
  ): Promise<{ segment: FileSegmentMetadata }> {
    return this.request(`/files/${fileId}/parts/${partNumber}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async completeFile(fileId: string): Promise<{ file: VaultFile }> {
    return this.request(`/files/${fileId}/complete`, {
      method: 'POST',
    });
  }

  public async listFiles(search?: string): Promise<{ files: VaultFile[] }> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/files${q}`);
  }

  public async getFileDetails(fileId: string): Promise<{ file: VaultFile; segments: FileSegmentMetadata[] }> {
    return this.request(`/files/${fileId}`);
  }

  public async getDownloadPresignedUrl(
    fileId: string,
    partNumber: number
  ): Promise<{
    downloadUrl: string;
    isRealS3: boolean;
    s3ObjectKey: string;
    encryptionIv: string;
    checksum: string;
    encryptedSize: number;
  }> {
    return this.request(`/files/${fileId}/parts/${partNumber}/download-url`, {
      method: 'POST',
    });
  }

  public async deleteFile(fileId: string): Promise<{ message: string }> {
    return this.request(`/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  // Activity & Stats
  public async getActivity(): Promise<{ logs: ActivityLog[] }> {
    return this.request('/activity');
  }

  public async getStats(): Promise<DashboardStats> {
    return this.request('/stats');
  }

  /**
   * Direct Browser-to-S3 Upload of an encrypted block
   */
  public async uploadChunkDirectToS3(uploadUrl: string, chunkBlob: Blob): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: chunkBlob,
    });

    if (!res.ok) {
      throw new Error(`S3 direct upload failed with status ${res.status}: ${res.statusText}`);
    }
  }

  /**
   * Direct S3-to-Browser Download of an encrypted block
   */
  public async downloadChunkDirectFromS3(downloadUrl: string): Promise<ArrayBuffer> {
    const res = await fetch(downloadUrl, {
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error(`S3 direct download failed with status ${res.status}: ${res.statusText}`);
    }

    return await res.arrayBuffer();
  }
}

export const api = new ApiClient();
