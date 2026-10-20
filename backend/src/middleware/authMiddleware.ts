import { Request, Response, NextFunction } from 'express';
import { AuthService, UserPayload } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header. Bearer token required.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = AuthService.verifyToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication session has expired.' });
    return;
  }
}
