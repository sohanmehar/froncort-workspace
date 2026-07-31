import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ConnectionStatus, Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// ==========================================
// ⚡ REAL DATABASE TENANT GOVERNANCE ENDPOINTS
// ==========================================

// 1. GET ALL ORGANIZATIONS DIRECTLY FROM POSTGRES DB
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, domain: true, createdAt: true },
    });
    return res.json({ organizations });
  } catch (error: any) {
    console.error('Error fetching orgs:', error);
    return res.status(500).json({ error: 'Database fetch failed' });
  }
});

// 2. CREATE NEW TENANT IN POSTGRES DB
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, domain } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  const cleanName = name.trim();
  const cleanDomain = domain?.trim() || `${cleanName.toLowerCase().replace(/\s+/g, '')}.com`;

  try {
    const existing = await prisma.organization.findFirst({
      where: {
        OR: [{ name: cleanName }, { domain: cleanDomain }],
      },
    });

    if (existing) {
      return res.status(200).json({ message: 'Organization already exists', organization: existing });
    }

    const organization = await prisma.organization.create({
      data: { name: cleanName, domain: cleanDomain },
    });

    return res.status(201).json({ message: 'Organization created', organization });
  } catch (error: any) {
    console.error('Create Org DB Error:', error);
    return res.status(500).json({ error: 'Failed to create organization in database' });
  }
});

// 3. DELETE TENANT FROM DB
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.organization.delete({ where: { id: String(id) } });
    return res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// 4. ASSIGN USER ROLE & AUTO-PROVISION USER IN DB WITH DEFAULT PASSWORD "password123"
router.post('/memberships', async (req: AuthRequest, res: Response) => {
  const { email, orgId, role } = req.body;

  if (!email || !orgId) {
    return res.status(400).json({ error: 'Email and Organization ID are required' });
  }

  try {
    const targetRole = (role as Role) || Role.ORG_ADMIN;

    // Check if user exists in DB, if not auto-create with password123
    let user = await prisma.user.findUnique({ where: { email: email.trim() } });

    if (!user) {
      const defaultPasswordHash = await bcrypt.hash('password123', 10);
      const namePart = email.split('@')[0];
      const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

      user = await prisma.user.create({
        data: {
          email: email.trim(),
          fullName: `${fullName} (${targetRole})`,
          passwordHash: defaultPasswordHash,
        },
      });
    }

    // Upsert Membership record
    const membership = await prisma.membership.upsert({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: orgId,
        },
      },
      update: { role: targetRole },
      create: {
        userId: user.id,
        orgId: orgId,
        role: targetRole,
      },
    });

    return res.json({
      message: `User ${email} linked to org with role ${targetRole}. Login password: password123`,
      user: { id: user.id, email: user.email },
      membership,
    });
  } catch (error: any) {
    console.error('Membership Error:', error);
    return res.status(500).json({ error: 'Failed to assign membership in DB' });
  }
});

// ==========================================
// 🤝 CONNECTIONS & NOTIFICATIONS
// ==========================================

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