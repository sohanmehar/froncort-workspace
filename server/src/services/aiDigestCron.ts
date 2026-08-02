import cron from 'node-cron';
import { prisma } from '../config/db';

export const generateScheduledAIDigest = async () => {
  try {
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    for (const user of users) {
      const activeOrgId = user.memberships[0]?.orgId;
      if (!activeOrgId) continue;

      const openTickets = await prisma.ticket.count({
        where: { orgId: activeOrgId, status: 'OPEN' },
      });

      const pendingPRs = await prisma.pullRequest.count({
        where: { orgId: activeOrgId, status: 'IN_REVIEW' },
      });

      const message = `Personalized Digest: You have ${openTickets} active assigned ticket(s) and ${pendingPRs} PR(s) waiting for review in your workspace.`;

      // FIX: Removed orgId from where filter
      const existing = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          message: message,
        },
      });

      if (!existing) {
        // FIX: Removed orgId from creation payload
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: 'Scheduled AI Progress Digest',
            message: message,
            isRead: false,
          },
        });
      }
    }
  } catch (err) {
    console.error('Error in scheduled AI digest cron:', err);
  }
};

export const initAIDigestCron = () => {
  cron.schedule('0 * * * *', () => {
    generateScheduledAIDigest();
  });
};