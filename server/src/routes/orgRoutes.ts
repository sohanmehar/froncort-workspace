import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ConnectionStatus } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// 1. GET ALL PARTNER CONNECTIONS
router.get('/connections', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;

  try {
    const connections = await prisma.orgConnection.findMany({
      where: {
        OR: [{ initiatorOrgId: activeOrgId }, { receiverOrgId: activeOrgId }],
      },
      include: {
        initiatorOrg: { select: { id: true, name: true, domain: true } },
        receiverOrg: { select: { id: true, name: true, domain: true } },
      },
    });

    res.json({ connections });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch partner connections' });
  }
});

// 2. REQUEST PARTNER CONNECTION WITH ANOTHER ORG
router.post('/connections/request', async (req: AuthRequest, res: Response) => {
  const { targetOrgId } = req.body;
  const activeOrgId = req.user!.activeOrgId;

  if (!targetOrgId || targetOrgId === activeOrgId) {
    return res.status(400).json({ error: 'Invalid target organization ID' });
  }

  try {
    const connection = await prisma.orgConnection.create({
      data: {
        initiatorOrgId: activeOrgId,
        receiverOrgId: String(targetOrgId),
        status: ConnectionStatus.PENDING,
      },
    });

    res.status(201).json({ message: 'Connection request sent', connection });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request connection' });
  }
});

// 3. ACCEPT / REVOKE CONNECTION
router.patch('/connections/:id', async (req: AuthRequest, res: Response) => {
  const connectionId = req.params.id as string;
  const { status } = req.body;

  if (!['ACCEPTED', 'REVOKED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updated = await prisma.orgConnection.update({
      where: { id: connectionId },
      data: { status: status as ConnectionStatus },
    });

    res.json({ message: `Connection status updated to ${status}`, connection: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

// 4. GET USER NOTIFICATIONS / AI DIGESTS
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

export default router;