import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import ticketRoutes from './routes/ticketRoutes';
import prRoutes from './routes/prRoutes';
import auditRoutes from './routes/auditRoutes';
import orgRoutes from './routes/orgRoutes';
import { generateScheduledAIDigest as initAIDigestCron } from './services/aiDigestCron';
import { prisma } from './config/db';

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
app.use('/api/org', orgRoutes); // Fallback alias route for cross-compatibility

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Froncort Unified Org Workspace API is live!' });
});

// Fast Notification Seeder Route for Testing
app.post('/api/seed-notifications', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      return res.status(404).json({ error: 'No user found in database' });
    }

    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          title: 'Ticket Created',
          message: 'Support ticket #tk101 "Optimize Database Query Latency" created.',
          isRead: false,
        },
        {
          userId: user.id,
          title: 'Pull Request Submitted',
          message: 'Pull Request "feat: Add unified JWT auth middleware" submitted.',
          isRead: false,
        },
        {
          userId: user.id,
          title: 'PR Review: APPROVED',
          message: 'Pull Request "feat: Add unified JWT auth middleware" marked as APPROVED.',
          isRead: false,
        },
      ],
    });

    res.json({ message: 'Notifications seeded successfully!' });
  } catch (error: any) {
    console.error('Seed Error:', error);
    res.status(500).json({ error: 'Failed to seed notifications', details: error?.message });
  }
});

// Initialize Background AI Cron Tracker
if (process.env.NODE_ENV !== 'test') {
  initAIDigestCron();
}

// Start server ONLY when not running unit/integration tests
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;