import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

const generateToken = (userId: string, activeOrgId: string, role: Role, tokenVersion: number) => {
  return jwt.sign(
    { userId, activeOrgId, role, tokenVersion },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 1. REGISTER
router.post('/register', async (req, res) => {
  const { email, password, fullName, orgName } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, fullName },
      });

      let orgId: string = '';
      let role: Role = Role.SUPPORT_AGENT;

      if (orgName) {
        const domain = email.split('@')[1] || `${orgName.toLowerCase().replace(/\s+/g, '')}.com`;
        const org = await tx.organization.create({
          data: { name: orgName, domain },
        });
        orgId = org.id;
        role = Role.ORG_ADMIN;

        await tx.membership.create({
          data: { userId: user.id, orgId: org.id, role: Role.ORG_ADMIN },
        });
      }

      return { user, orgId, role };
    });

    const token = result.orgId
      ? generateToken(result.user.id, result.orgId, result.role, result.user.tokenVersion)
      : null;

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName },
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.memberships.length === 0) {
      return res.status(400).json({ error: 'User does not belong to any organization' });
    }

    const primaryMembership = user.memberships[0];
    const token = generateToken(
      user.id,
      primaryMembership.orgId,
      primaryMembership.role,
      user.tokenVersion
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      activeOrg: primaryMembership.organization,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// 3. SWITCH ORGANIZATION CONTEXT
router.post('/switch-org', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { targetOrgId } = req.body;
  const userId = req.user!.userId;

  if (!targetOrgId) {
    return res.status(400).json({ error: 'Target Organization ID is required' });
  }

  try {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: targetOrgId } },
      include: { organization: true },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const newToken = generateToken(
      userId,
      membership.orgId,
      membership.role,
      user!.tokenVersion
    );

    res.json({
      message: `Switched active context to ${membership.organization.name}`,
      token: newToken,
      activeOrg: membership.organization,
      role: membership.role,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while switching organization' });
  }
});

// 4. LOGOUT EVERYWHERE
router.post('/logout-everywhere', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { tokenVersion: { increment: 1 } },
    });

    res.json({ message: 'Logged out successfully from all devices and dashboards' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete global logout' });
  }
});

// 5. GET ME
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        activeOrgId: req.user!.activeOrgId,
        role: req.user!.role,
        memberships: user.memberships.map((m) => ({
          orgId: m.orgId,
          orgName: m.organization.name,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user context' });
  }
});

export default router;