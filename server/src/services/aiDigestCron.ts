import cron from 'node-cron';
import { prisma } from '../config/db';

export const initAIDigestCron = () => {
  // Runs background digest generation periodically (or every hour/minute for demo)
  cron.schedule('0 * * * *', async () => {
    console.log('🤖 Running Background AI Progress Digest Job...');

    try {
      const users = await prisma.user.findMany({
        include: { memberships: true },
      });

      for (const user of users) {
        if (user.memberships.length === 0) continue;

        const activeOrgId = user.memberships[0].orgId;

        // Collect stats scoped strictly to user's org
        const assignedTicketsCount = await prisma.ticket.count({
          where: { orgId: activeOrgId, assignedToId: user.id, status: { not: 'CLOSED' } },
        });

        const pendingPRsCount = await prisma.pullRequest.count({
          where: { orgId: activeOrgId, status: 'IN_REVIEW' },
        });

        const digestMessage = `Personalized Digest: You have ${assignedTicketsCount} active assigned ticket(s) and ${pendingPRsCount} PR(s) waiting for review in your workspace.`;

        await prisma.notification.create({
          data: {
            userId: user.id,
            title: '📊 Scheduled AI Progress Digest',
            message: digestMessage,
          },
        });
      }
      console.log('✅ Digest generated for all active users.');
    } catch (error) {
      console.error('Digest Job Error:', error);
    }
  });
};