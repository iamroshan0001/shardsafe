import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/client.js';
import { storageService } from '../services/s3Service.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { config } from '../config/index.js';

const router = Router();

// Validation Schemas
const initiateFileSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  originalSize: z.number().int().positive('File size must be greater than 0'),
  segmentCount: z.number().int().min(1, 'Segment count must be at least 1'),
  segmentSize: z.number().int().min(64 * 1024, 'Segment size must be at least 64KB'),
  encryptionSalt: z.string().min(16, 'Encryption salt must be at least 16 characters hex/base64'),
  keyDerivationParameters: z.object({
    algorithm: z.literal('PBKDF2-HMAC-SHA-256'),
    iterations: z.number().int().min(10000),
    keyLengthBits: z.literal(256),
    cipher: z.literal('AES-GCM-256'),
  }),
});

const completePartSchema = z.object({
  encryptedSize: z.number().int().positive(),
  encryptionIv: z.string().min(12, 'IV must be valid hex/base64'),
  checksum: z.string().min(16, 'Checksum must be valid hash'),
});

/**
 * 1. POST /api/files/initiate
 * Initializes file metadata record and pre-allocates segment keys
 */
router.post('/initiate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = initiateFileSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const {
      originalFilename,
      mimeType,
      originalSize,
      segmentCount,
      segmentSize,
      encryptionSalt,
      keyDerivationParameters,
    } = parse.data;

    // Enforce max file size
    const maxBytes = config.maxFileSizeMb * 1024 * 1024;
    if (originalSize > maxBytes) {
      res.status(400).json({
        error: `File size exceeds the maximum limit of ${config.maxFileSizeMb} MB`,
      });
      return;
    }

    const userId = req.user!.id;
    const randomFileId = crypto.randomUUID();

    // Insert file metadata into RDS / DB
    const fileResult = await db.query(
      `INSERT INTO files (
        id, user_id, original_filename, mime_type, original_size,
        segment_count, segment_size, encryption_salt, key_derivation_parameters, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        randomFileId,
        userId,
        originalFilename,
        mimeType,
        originalSize,
        segmentCount,
        segmentSize,
        encryptionSalt,
        JSON.stringify(keyDerivationParameters),
        'pending',
      ]
    );

    const file = fileResult.rows[0];

    // Pre-register segment entries with structured opaque S3 keys
    // vault/{userId}/{randomFileId}/part-000001.bin
    const segments = [];
    for (let partNum = 1; partNum <= segmentCount; partNum++) {
      const paddedNum = String(partNum).padStart(6, '0');
      const s3Key = `vault/${userId}/${randomFileId}/part-${paddedNum}.bin`;

      await db.query(
        `INSERT INTO file_segments (
          file_id, segment_number, s3_object_key, encrypted_size, encryption_iv, checksum, upload_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomFileId, partNum, s3Key, 0, '', '', 'pending']
      );

      segments.push({
        segmentNumber: partNum,
        s3ObjectKey: s3Key,
        uploadStatus: 'pending',
      });
    }

    // Log Activity
    await db.query(
      `INSERT INTO activity_logs (user_id, file_id, operation, status, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        randomFileId,
        'UPLOAD_INITIATE',
        'success',
        JSON.stringify({
          filename: originalFilename,
          size: originalSize,
          segments: segmentCount,
        }),
      ]
    );

    res.status(201).json({
      message: 'File upload initiated successfully',
      file: {
        id: file.id,
        originalFilename: file.original_filename,
        originalSize: file.original_size,
        segmentCount: file.segment_count,
        segmentSize: file.segment_size,
        encryptionSalt: file.encryption_salt,
        status: file.status,
      },
      segments,
    });
  } catch (err: any) {
    console.error('[Files] Initiate error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate file upload' });
  }
});

/**
 * 2. POST /api/files/:id/parts/:partNumber/upload-url
 * Generates presigned S3 upload URL for an encrypted chunk
 */
router.post('/:id/parts/:partNumber/upload-url', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = String(req.params.id);
    const partNumber = parseInt(String(req.params.partNumber), 10);
    const userId = req.user!.id;

    if (isNaN(partNumber) || partNumber < 1) {
      res.status(400).json({ error: 'Invalid part number' });
      return;
    }

    // Verify file ownership
    const fileCheck = await db.query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
    if (fileCheck.rows.length === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    // Find segment
    const segmentCheck = await db.query(
      'SELECT * FROM file_segments WHERE file_id = $1 AND segment_number = $2',
      [fileId, partNumber]
    );

    if (segmentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Segment not found for this file' });
      return;
    }

    const segment = segmentCheck.rows[0];

    // Generate signed upload URL for this specific S3 object key
    const { uploadUrl, isRealS3 } = await storageService.getUploadPresignedUrl(segment.s3_object_key);

    res.json({
      fileId,
      partNumber,
      s3ObjectKey: segment.s3_object_key,
      uploadUrl,
      isRealS3,
      expiresInSeconds: config.presignedUrlExpiresSeconds,
    });
  } catch (err: any) {
    console.error('[Files] Upload URL error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate upload URL' });
  }
});

/**
 * 3. POST /api/files/:id/parts/:partNumber/complete
 * Records metadata for an uploaded encrypted chunk
 */
router.post('/:id/parts/:partNumber/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = String(req.params.id);
    const partNumber = parseInt(String(req.params.partNumber), 10);
    const userId = req.user!.id;

    const parse = completePartSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { encryptedSize, encryptionIv, checksum } = parse.data;

    // Verify ownership
    const fileCheck = await db.query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
    if (fileCheck.rows.length === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    // Update segment
    const result = await db.query(
      `UPDATE file_segments
       SET encrypted_size = $3,
           encryption_iv = $4,
           checksum = $5,
           upload_status = 'uploaded',
           uploaded_at = CURRENT_TIMESTAMP
       WHERE file_id = $1 AND segment_number = $2
       RETURNING *`,
      [fileId, partNumber, encryptedSize, encryptionIv, checksum]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Segment not found' });
      return;
    }

    res.json({
      message: `Segment ${partNumber} registered successfully`,
      segment: result.rows[0],
    });
  } catch (err: any) {
    console.error('[Files] Complete part error:', err);
    res.status(500).json({ error: err.message || 'Failed to register segment' });
  }
});

/**
 * 4. POST /api/files/:id/complete
 * Finalizes file upload after verifying all segments
 */
router.post('/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.user!.id;

    // Fetch file
    const fileCheck = await db.query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
    if (fileCheck.rows.length === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileCheck.rows[0];

    // Fetch segments
    const segmentsRes = await db.query(
      'SELECT * FROM file_segments WHERE file_id = $1 ORDER BY segment_number ASC',
      [fileId]
    );

    const segments = segmentsRes.rows;
    if (segments.length !== file.segment_count) {
      res.status(400).json({
        error: `Expected ${file.segment_count} segments, but database has ${segments.length}`,
      });
      return;
    }

    // Verify every segment is marked uploaded and has an IV & checksum
    const incomplete = segments.filter((s) => s.upload_status !== 'uploaded' || !s.encryption_iv || !s.checksum);
    if (incomplete.length > 0) {
      res.status(400).json({
        error: `Cannot complete file: ${incomplete.length} segments are still pending or missing encryption parameters`,
        missingSegments: incomplete.map((s) => s.segment_number),
      });
      return;
    }

    // Mark file as completed
    const updated = await db.query(
      'UPDATE files SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['completed', fileId]
    );

    // Activity log
    await db.query(
      `INSERT INTO activity_logs (user_id, file_id, operation, status, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        fileId,
        'UPLOAD_COMPLETE',
        'success',
        JSON.stringify({
          filename: file.original_filename,
          segments: file.segment_count,
          size: file.original_size,
        }),
      ]
    );

    res.json({
      message: 'File upload verified and marked complete in vault',
      file: updated.rows[0],
    });
  } catch (err: any) {
    console.error('[Files] Complete error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete file' });
  }
});

/**
 * 5. GET /api/files
 * Lists all files for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const filesRes = await db.query(
      'SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    let files = filesRes.rows;
    if (search) {
      files = files.filter((f) => f.original_filename.toLowerCase().includes(search.toLowerCase()));
    }

    res.json({ files });
  } catch (err: any) {
    console.error('[Files] List error:', err);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

/**
 * 6. GET /api/files/:id
 * Retrieves file metadata and all segment details for download/inspection
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.user!.id;

    const fileRes = await db.query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];

    const segmentsRes = await db.query(
      'SELECT id, segment_number, s3_object_key, encrypted_size, encryption_iv, checksum, upload_status, uploaded_at FROM file_segments WHERE file_id = $1 ORDER BY segment_number ASC',
      [fileId]
    );

    res.json({
      file,
      segments: segmentsRes.rows,
    });
  } catch (err: any) {
    console.error('[Files] Details error:', err);
    res.status(500).json({ error: 'Failed to retrieve file details' });
  }
});

/**
 * 7. POST /api/files/:id/parts/:partNumber/download-url
 * Generates presigned S3 download URL for an encrypted chunk
 */
router.post('/:id/parts/:partNumber/download-url', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = String(req.params.id);
    const partNumber = parseInt(String(req.params.partNumber), 10);
    const userId = req.user!.id;

    // Verify ownership
    const fileRes = await db.query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    // Find segment
    const segmentRes = await db.query(
      'SELECT * FROM file_segments WHERE file_id = $1 AND segment_number = $2',
      [fileId, partNumber]
    );

    if (segmentRes.rows.length === 0) {
      res.status(404).json({ error: 'Segment not found' });
      return;
    }

    const segment = segmentRes.rows[0];
    const { downloadUrl, isRealS3 } = await storageService.getDownloadPresignedUrl(segment.s3_object_key);

    res.json({
      fileId,
      partNumber,
      s3ObjectKey: segment.s3_object_key,
      encryptionIv: segment.encryption_iv,
      checksum: segment.checksum,
      encryptedSize: segment.encrypted_size,
      downloadUrl,
      isRealS3,
      expiresInSeconds: config.presignedUrlExpiresSeconds,
    });
  } catch (err: any) {
    console.error('[Files] Download URL error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate download URL' });
  }
});

/**
 * 8. DELETE /api/files/:id
 * Deletes segments from S3 and metadata from RDS
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id;
    const userId = req.user!.id;

    const fileRes = await db.query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
    if (fileRes.rows.length === 0) {
      res.status(404).json({ error: 'File not found or access denied' });
      return;
    }

    const file = fileRes.rows[0];

    // Get segments to clean up from S3
    const segmentsRes = await db.query('SELECT s3_object_key FROM file_segments WHERE file_id = $1', [fileId]);
    
    // Delete each object from S3
    for (const seg of segmentsRes.rows) {
      try {
        await storageService.deleteObject(seg.s3_object_key);
      } catch (err: any) {
        console.warn(`[Files] Warning: failed to delete S3 object ${seg.s3_object_key}:`, err.message);
      }
    }

    // Delete record from DB
    await db.query('DELETE FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (user_id, file_id, operation, status, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        fileId,
        'DELETE_FILE',
        'success',
        JSON.stringify({ filename: file.original_filename }),
      ]
    );

    res.json({ message: 'File and its encrypted segments permanently deleted from vault' });
  } catch (err: any) {
    console.error('[Files] Delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete file' });
  }
});

export default router;
