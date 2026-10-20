import request from 'supertest';
import { app } from '../src/index.js';

describe('ShardSafe Backend API Tests', () => {
  let authToken = '';
  let userId = '';
  let testFileId = '';
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  describe('1. Health Check Endpoint', () => {
    it('GET /api/health returns 200 with service information', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('ShardSafe Cloud API');
      expect(res.body.services.database).toBeDefined();
      expect(res.body.services.storage).toBeDefined();
    });
  });

  describe('2. Authentication', () => {
    it('POST /api/auth/register creates a new user and returns JWT', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      authToken = res.body.token;
      userId = res.body.user.id;
    });

    it('POST /api/auth/register fails on duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already exists');
    });

    it('POST /api/auth/login fails on incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
    });

    it('POST /api/auth/login succeeds with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('GET /api/auth/me returns user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
    });
  });

  describe('3. File Vault Operations', () => {
    it('POST /api/files/initiate creates file record and segment entries', async () => {
      const res = await request(app)
        .post('/api/files/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalFilename: 'project_report.pdf',
          mimeType: 'application/pdf',
          originalSize: 2097152, // 2MB
          segmentCount: 2,
          segmentSize: 1048576, // 1MB
          encryptionSalt: 'a1b2c3d4e5f67890123456789abcdef0',
          keyDerivationParameters: {
            algorithm: 'PBKDF2-HMAC-SHA-256',
            iterations: 100000,
            keyLengthBits: 256,
            cipher: 'AES-GCM-256',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.file.id).toBeDefined();
      expect(res.body.segments.length).toBe(2);
      testFileId = res.body.file.id;
    });

    it('POST /api/files/:id/parts/:partNumber/upload-url generates presigned upload URL', async () => {
      const res = await request(app)
        .post(`/api/files/${testFileId}/parts/1/upload-url`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.s3ObjectKey).toContain('vault/');
    });

    it('POST /api/files/:id/parts/:partNumber/complete updates segment status', async () => {
      // Complete part 1
      const res1 = await request(app)
        .post(`/api/files/${testFileId}/parts/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          encryptedSize: 1048604,
          encryptionIv: 'iv_chunk_1_test_hex_data',
          checksum: 'sha256_checksum_chunk_1',
        });
      expect(res1.status).toBe(200);

      // Complete part 2
      const res2 = await request(app)
        .post(`/api/files/${testFileId}/parts/2/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          encryptedSize: 1048604,
          encryptionIv: 'iv_chunk_2_test_hex_data',
          checksum: 'sha256_checksum_chunk_2',
        });
      expect(res2.status).toBe(200);
    });

    it('POST /api/files/:id/complete marks entire file complete', async () => {
      const res = await request(app)
        .post(`/api/files/${testFileId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.file.status).toBe('completed');
    });

    it('GET /api/files/:id retrieves completed file with segment details', async () => {
      const res = await request(app)
        .get(`/api/files/${testFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.file.original_filename).toBe('project_report.pdf');
      expect(res.body.segments.length).toBe(2);
      expect(res.body.segments[0].upload_status).toBe('uploaded');
    });

    it('POST /api/files/:id/parts/:partNumber/download-url generates download URL', async () => {
      const res = await request(app)
        .post(`/api/files/${testFileId}/parts/1/download-url`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBeDefined();
      expect(res.body.encryptionIv).toBe('iv_chunk_1_test_hex_data');
    });
  });

  describe('4. Activity and Statistics', () => {
    it('GET /api/activity returns operation audit logs', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.logs.length).toBeGreaterThan(0);
    });

    it('GET /api/stats returns vault metrics', async () => {
      const res = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.fileCount).toBeGreaterThanOrEqual(1);
      expect(res.body.segmentCount).toBeGreaterThanOrEqual(2);
    });
  });
});
