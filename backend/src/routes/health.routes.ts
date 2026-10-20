import { Router, Request, Response } from 'express';
import { db } from '../db/client.js';
import { storageService } from '../services/s3Service.js';
import { config } from '../config/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const [dbStatus, storageStatus] = await Promise.all([
    db.getStatus(),
    storageService.getStatus(),
  ]);

  const memUsage = process.memoryUsage();
  
  const isHealthy = dbStatus.connected && storageStatus.connected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'ShardSafe Cloud API',
    version: '1.0.0',
    environment: config.env,
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: Date.now() - startTime,
    nodeVersion: process.version,
    memory: {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      rssMb: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
    },
    services: {
      database: dbStatus,
      storage: storageStatus,
    },
  });
});

export default router;
