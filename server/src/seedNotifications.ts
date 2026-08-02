import { prisma } from './config/db';

async function seedUserNotifications() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log('No user found!');

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

  console.log('✅ Fresh Ticket & PR notifications seeded successfully!');
}

seedUserNotifications();