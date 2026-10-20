import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

const authSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const parse = authSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { email, password } = parse.data;
    const result = await AuthService.register(email, password);
    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parse = authSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { email, password } = parse.data;
    const result = await AuthService.login(email, password);
    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token,
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

router.post('/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await AuthService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User account not found' });
      return;
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

export default router;
