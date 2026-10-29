import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import fileRoutes from './routes/file.routes.js';
import healthRoutes from './routes/health.routes.js';
import activityRoutes from './routes/activity.routes.js';
import storageRoutes from './routes/storage.routes.js';

export const app = express();

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS Configuration — allowed origins (Amazon RDS & CloudFront Connected)
const allowedOrigins = [
  config.frontendOrigin,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  // Amazon CloudFront CDN
  'https://d2uik681lagcwn.cloudfront.net',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow: no origin (curl/mobile/local), explicit list, any CloudFront distribution
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.cloudfront.net')
    ) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-amz-server-side-encryption'],
}));

// Rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 auth requests per window
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// JSON Body Parser for API routes (excludes raw storage routes)
app.use('/api/storage', storageRoutes);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request Logger (Structured, no sensitive data)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/api/storage') && req.path !== '/api/health') {
      console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Mount Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api', activityRoutes); // mounts /api/stats

// Root fallback
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'ShardSafe Cloud API',
    status: 'online',
    version: '1.0.0',
    documentation: '/docs',
    health: '/api/health',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(config.env === 'development' ? { stack: err.stack } : {}),
  });
});

// Start Server if not imported by tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 ShardSafe Backend running on port ${config.port}`);
    console.log(`📦 Environment: ${config.env}`);
    console.log(`🌐 Region: ${config.awsRegion}`);
    console.log(`🗄️ Storage: ${config.storageProvider.toUpperCase()}`);
    console.log(`📡 Health Check: http://localhost:${config.port}/api/health`);
    console.log(`====================================================`);
  });
}
