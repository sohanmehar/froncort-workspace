import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import ticketRoutes from './routes/ticketRoutes';
import prRoutes from './routes/prRoutes';
import auditRoutes from './routes/auditRoutes';
import orgRoutes from './routes/orgRoutes';
import { initAIDigestCron } from './services/aiDigestCron';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware configuration - Allow Vercel Frontend & Credentials
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/prs', prRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/orgs', orgRoutes); 

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Froncort Unified Org Workspace API is live!' });
});

// Initialize Background AI Cron Tracker
if (process.env.NODE_ENV !== 'test') {
  initAIDigestCron();
}

// Start server ONLY when not running unit/integration tests
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (Connected to Vercel UI: https://froncort-workspace.vercel.app)`);
  });
}

export default app;