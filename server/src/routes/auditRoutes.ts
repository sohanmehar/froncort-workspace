import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// 1. SEARCH & MULTI-FILTER UNIFIED AUDIT LOGS
router.get('/', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;
  const { entityType, action, userId, startDate, endDate } = req.query;

  try {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        orgId: activeOrgId,
        ...(entityType ? { entityType: String(entityType) } : {}),
        ...(action ? { action: String(action) } : {}),
        ...(userId ? { userId: String(userId) } : {}),
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      include: {
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// 2. EXPORT FILTERED AUDIT LOGS AS CSV
router.get('/export', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;
  const { entityType, action, userId, startDate, endDate } = req.query;

  try {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        orgId: activeOrgId,
        ...(entityType ? { entityType: String(entityType) } : {}),
        ...(action ? { action: String(action) } : {}),
        ...(userId ? { userId: String(userId) } : {}),
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let csvContent = 'ID,Timestamp,User,Email,Action,Entity Type,Entity ID,Metadata\n';

    logs.forEach((log) => {
      const metadataStr = JSON.stringify(log.metadata || {}).replace(/"/g, '""');
      csvContent += `"${log.id}","${log.createdAt.toISOString()}","${log.user?.fullName || 'System'}","${log.user?.email || 'N/A'}","${log.action}","${log.entityType}","${log.entityId}","${metadataStr}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="unified-audit-export.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting audit CSV:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;