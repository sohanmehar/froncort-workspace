import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    activeOrgId: string;
    role: string;
    tokenVersion: number;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super-secret'
    ) as {
      userId: string;
      activeOrgId: string;
      role: string;
      tokenVersion: number;
    };

    // Verify token version (for Logout Everywhere feature)
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { tokenVersion: true },
    });

    if (!dbUser || dbUser.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Session expired or invalidated globally' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};