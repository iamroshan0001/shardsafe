import { Router, Request, Response } from 'express';
import express from 'express';
import { storageService } from '../services/s3Service.js';

const router = Router();

// PUT /api/storage/upload?key=...&token=...
// Direct binary stream upload matching S3 PutObject behavior
router.put('/upload', express.raw({ type: '*/*', limit: '100mb' }), (req: Request, res: Response) => {
  const key = req.query.key as string;
  const token = req.query.token as string;

  if (!key || !token) {
    res.status(400).json({ error: 'Missing key or token in query parameter' });
    return;
  }

  const isValid = storageService.verifyToken(key, 'upload', token);
  if (!isValid) {
    res.status(403).json({ error: 'SignatureDoesNotMatch: Access token is invalid or expired' });
    return;
  }

  const data = req.body;
  if (!Buffer.isBuffer(data)) {
    res.status(400).json({ error: 'Expected raw binary body' });
    return;
  }

  storageService.saveLocalObject(key, data);
  res.setHeader('ETag', `"${Date.now().toString(16)}"`);
  res.status(200).send();
});

// GET /api/storage/download?key=...&token=...
// Direct binary stream download matching S3 GetObject behavior
router.get('/download', (req: Request, res: Response) => {
  const key = req.query.key as string;
  const token = req.query.token as string;

  if (!key || !token) {
    res.status(400).json({ error: 'Missing key or token' });
    return;
  }

  const isValid = storageService.verifyToken(key, 'download', token);
  if (!isValid) {
    res.status(403).json({ error: 'SignatureDoesNotMatch: Access token is invalid or expired' });
    return;
  }

  const data = storageService.getLocalObject(key);
  if (!data) {
    res.status(404).json({ error: 'NoSuchKey: The specified object does not exist' });
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', data.length);
  res.send(data);
});

export default router;
