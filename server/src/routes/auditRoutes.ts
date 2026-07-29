import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// 1. SEARCH & FILTER UNIFIED AUDIT LOGS
router.get('/', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;
  const { entityType, action } = req.query;

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        orgId: activeOrgId,
        ...(entityType ? { entityType: String(entityType) } : {}),
        ...(action ? { action: String(action) } : {}),
      },
      include: {
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// 2. EXPORT AUDIT LOGS AS CSV
router.get('/export', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;

  try {
    const logs = await prisma.auditLog.findMany({
      where: { orgId: activeOrgId },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let csvContent = 'ID,Timestamp,User,Email,Action,Entity Type,Entity ID\n';

    logs.forEach((log) => {
      csvContent += `"${log.id}","${log.createdAt.toISOString()}","${log.user.fullName}","${log.user.email}","${log.action}","${log.entityType}","${log.entityId}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log-export.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;