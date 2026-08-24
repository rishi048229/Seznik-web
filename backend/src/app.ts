import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import prisma from './config/db';
import authRoutes from './routes/authRoutes';
import categoryRoutes from './routes/categoryRoutes';
import settingsRoutes from './routes/settingsRoutes';
import customerRoutes from './routes/customerRoutes';
import supplierRoutes from './routes/supplierRoutes';
import productRoutes from './routes/productRoutes';
import saleRoutes from './routes/saleRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import expenseRoutes from './routes/expenseRoutes';
import creditRoutes from './routes/creditRoutes';
import reportRoutes from './routes/reportRoutes';
import feedbackRoutes from './routes/feedbackRoutes';
import tokenTypeRoutes from './routes/tokenTypeRoutes';
import tokenRoutes from './routes/tokenRoutes';
import restaurantTableRoutes from './routes/restaurantTableRoutes';
import kotOrderRoutes from './routes/kotOrderRoutes';
import locationRoutes from './routes/locationRoutes';
const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow inline styles/scripts if needed for frontend SPA
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 1b. Gzip every response — previously every JSON payload (including the large report responses)
// was sent uncompressed.
app.use(compression());

// 2. CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.seznik.com')) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-friendly fallback
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  })
);

app.use(
  ['/api/products/ai-extract', '/api/products/ai-extract-document', '/api/products/ai-convert-invoice'],
  express.json({ limit: '50mb' })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// 3. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/token-types', tokenTypeRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/restaurant-tables', restaurantTableRoutes);
app.use('/api/kot-orders', kotOrderRoutes);
app.use('/api/locations', locationRoutes);

// 5. Comprehensive Server & Database Health Check Endpoint
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
      },
      environment: process.env.NODE_ENV || 'production',
      memoryUsageMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Database ping failed',
      },
    });
  }
});

// 6. 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// 7. Global Central Error Handler Middleware
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({ error: message });
});

export default app;
