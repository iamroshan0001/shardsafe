import { Router, Response } from 'express';
import { db } from '../db/client.js';
import { storageService } from '../services/s3Service.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/activity - Retrieve operation audit logs
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const logsRes = await db.query(
      'SELECT id, file_id, operation, status, details, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    res.json({ logs: logsRes.rows });
  } catch (err: any) {
    console.error('[Activity] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve activity log' });
  }
});

// GET /api/stats - Dashboard metrics computed directly from database
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [statsRes, dbStatus, storageStatus] = await Promise.all([
      db.query('SELECT STATS', [userId]),
      db.getStatus(),
      storageService.getStatus(),
    ]);

    const stat = statsRes.rows[0] || {
      file_count: 0,
      segment_count: 0,
      total_bytes: 0,
      total_encrypted_bytes: 0,
    };

    res.json({
      fileCount: Number(stat.file_count || 0),
      segmentCount: Number(stat.segment_count || 0),
      totalBytes: Number(stat.total_bytes || 0),
      totalEncryptedBytes: Number(stat.total_encrypted_bytes || 0),
      services: {
        database: dbStatus,
        storage: storageStatus,
      },
    });
  } catch (err: any) {
    console.error('[Stats] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
});

export default router;
