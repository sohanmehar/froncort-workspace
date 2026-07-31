import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ConnectionStatus, Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// 1. GET ALL ORGANIZATIONS FROM DB
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ organizations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// 2. CREATE / ONBOARD NEW ORGANIZATION IN DB
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, domain } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  const generatedDomain = domain?.trim() || `${name.toLowerCase().replace(/\s+/g, '')}.com`;

  try {
    const existingOrg = await prisma.organization.findFirst({
      where: { OR: [{ name }, { domain: generatedDomain }] },
    });

    if (existingOrg) {
      return res.status(200).json({ message: 'Organization already exists', organization: existingOrg });
    }

    const organization = await prisma.organization.create({
      data: { name, domain: generatedDomain },
    });

    res.status(201).json({ message: 'Organization created successfully', organization });
  } catch (error: any) {
    console.error('Create Org Error:', error);
    res.status(500).json({ error: 'Failed to create organization in database' });
  }
});

// 3. DELETE ORGANIZATION FROM DB
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.organization.delete({ where: { id: String(id) } });
    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// 4. ASSIGN USER MEMBERSHIP (PROVISION USER WITH DEFAULT PASSWORD IF NOT EXISTS)
router.post('/memberships', async (req: AuthRequest, res: Response) => {
  const { email, orgId, role } = req.body;

  if (!email || !orgId) {
    return res.status(400).json({ error: 'Email and Organization ID are required' });
  }

  try {
    // Check if target Org exists
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: 'Target organization not found in database' });
    }

    // Check if User exists in DB
    let user = await prisma.user.findUnique({ where: { email } });

    // If User doesn't exist, AUTO-CREATE user with hashed 'password123'
    if (!user) {
      const defaultPasswordHash = await bcrypt.hash('password123', 10);
      const namePart = email.split('@')[0];
      const fullName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

      user = await prisma.user.create({
        data: {
          email,
          fullName: `${fullName} User`,
          passwordHash: defaultPasswordHash,
        },
      });
    }

    // Link/Upsert Membership
    const targetRole = (role as Role) || Role.ORG_ADMIN;
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

    res.json({
      message: `User ${email} linked to ${org.name} with role ${targetRole}. Password: password123`,
      user: { id: user.id, email: user.email, fullName: user.fullName },
      membership,
    });
  } catch (error: any) {
    console.error('Membership Assignment Error:', error);
    res.status(500).json({ error: 'Failed to assign membership in database' });
  }
});

// GET ALL PARTNER CONNECTIONS
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

// REQUEST / RE-ACTIVATE PARTNER CONNECTION WITH ANOTHER ORG
router.post('/connections/request', async (req: AuthRequest, res: Response) => {
  const { targetOrgId } = req.body;
  const activeOrgId = req.user!.activeOrgId;

  if (!targetOrgId || targetOrgId === activeOrgId) {
    return res.status(400).json({ error: 'Invalid target organization ID' });
  }

  try {
    // Check if a connection record already exists in either direction
    const existingConnection = await prisma.orgConnection.findFirst({
      where: {
        OR: [
          { initiatorOrgId: activeOrgId, receiverOrgId: String(targetOrgId) },
          { initiatorOrgId: String(targetOrgId), receiverOrgId: activeOrgId },
        ],
      },
    });

    if (existingConnection) {
      // If connection is already active or pending, reject duplicate request
      if (existingConnection.status === ConnectionStatus.ACCEPTED || existingConnection.status === ConnectionStatus.PENDING) {
        return res.status(400).json({ error: `Connection request is already ${existingConnection.status.toLowerCase()}` });
      }

      // If status is REVOKED or REJECTED, update and re-activate it back to PENDING
      const updatedConnection = await prisma.orgConnection.update({
        where: { id: existingConnection.id },
        data: {
          initiatorOrgId: activeOrgId,
          receiverOrgId: String(targetOrgId),
          status: ConnectionStatus.PENDING,
        },
      });

      return res.status(200).json({ message: 'Connection re-requested successfully', connection: updatedConnection });
    }

    // Create brand new connection if no record existed before
    const connection = await prisma.orgConnection.create({
      data: {
        initiatorOrgId: activeOrgId,
        receiverOrgId: String(targetOrgId),
        status: ConnectionStatus.PENDING,
      },
    });

    res.status(201).json({ message: 'Connection request sent', connection });
  } catch (error) {
    console.error('Request Connection Error:', error);
    res.status(500).json({ error: 'Failed to request connection' });
  }
});

// ACCEPT / REVOKE CONNECTION
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

// GET USER NOTIFICATIONS / AI DIGESTS
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