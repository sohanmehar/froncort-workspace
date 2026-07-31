import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { TicketStatus, ResourceType } from '@prisma/client';

const router = Router();

// Apply Auth Middleware to all routes
router.use(authenticateToken);

// 1. GET ALL TICKETS (Scoped to Active Org + Shared Tickets with Owner Organization)
router.get('/', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;

  try {
    const ownTickets = await prisma.ticket.findMany({
      where: { orgId: activeOrgId },
      include: {
        comments: true,
        sharedEntries: true,
        organization: { select: { id: true, name: true } }, // 👈 Include Org details
      },
      orderBy: { createdAt: 'desc' },
    });

    const sharedEntries = await prisma.sharedResource.findMany({
      where: {
        sharedWithOrgId: activeOrgId,
        resourceType: ResourceType.TICKET,
      },
      include: {
        ticket: {
          include: { 
            comments: true,
            organization: { select: { id: true, name: true } }, // 👈 Include Source Org Name
          },
        },
      },
    });

    const sharedTickets = sharedEntries
      .map((entry) => entry.ticket)
      .filter((t) => t !== null);

    res.json({
      tickets: ownTickets,
      sharedTickets: sharedTickets,
    });
  } catch (error) {
    console.error('Fetch Tickets Error:', error);
    res.status(500).json({ error: 'Failed to retrieve tickets' });
  }
});

// 2. CREATE A TICKET + AUDIT LOG
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, description, assignedToId } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          orgId: activeOrgId,
          title: String(title),
          description: String(description),
          createdById: userId,
          assignedToId: assignedToId ? String(assignedToId) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId: userId,
          action: 'TICKET_CREATED',
          entityType: 'TICKET',
          entityId: ticket.id,
          metadata: { title: ticket.title },
        },
      });

      return ticket;
    });

    res.status(201).json({ message: 'Ticket created successfully', ticket: result });
  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// 3. GET SINGLE TICKET (With BOLA Protection & Org Details)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ticketId = req.params.id as string;
  const activeOrgId = req.user!.activeOrgId;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        comments: { include: { user: { select: { fullName: true, email: true } } } },
        sharedEntries: true,
        organization: { select: { id: true, name: true } }, // 👈 Include Org details
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const isOwnerOrg = ticket.orgId === activeOrgId;
    const isShared = ticket.sharedEntries.some((entry) => entry.sharedWithOrgId === activeOrgId);

    if (!isOwnerOrg && !isShared) {
      return res.status(403).json({ error: 'Access denied: BOLA protection intercepted unauthorized request' });
    }

    res.json({ ticket, isSharedAccess: !isOwnerOrg });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve ticket' });
  }
});

// 4. UPDATE TICKET STATUS + AUDIT LOG
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const ticketId = req.params.id as string;
  const { status } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!Object.values(TicketStatus).includes(status as TicketStatus)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.orgId !== activeOrgId) {
      return res.status(403).json({ error: 'Forbidden: External users cannot mutate ticket status' });
    }

    const oldStatus = ticket.status;

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: status as TicketStatus },
      });

      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId: userId,
          action: 'TICKET_STATUS_UPDATED',
          entityType: 'TICKET',
          entityId: ticket.id,
          metadata: { from: oldStatus, to: status },
        },
      });

      return updated;
    });

    res.json({ message: 'Status updated', ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// 5. ADD COMMENT TO TICKET
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  const ticketId = req.params.id as string;
  const { content } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!content) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { sharedEntries: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const isOwnerOrg = ticket.orgId === activeOrgId;
    const isShared = ticket.sharedEntries.some((entry) => entry.sharedWithOrgId === activeOrgId);

    if (!isOwnerOrg && !isShared) {
      return res.status(403).json({ error: 'Access denied: You cannot comment on this ticket' });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticketId,
        userId: userId,
        content: String(content),
      },
    });

    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// 6. SHARE TICKET WITH PARTNER ORG
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  const ticketId = req.params.id as string;
  const { targetOrgId } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!targetOrgId) {
    return res.status(400).json({ error: 'Target Organization ID is required' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket || ticket.orgId !== activeOrgId) {
      return res.status(403).json({ error: 'You can only share tickets originating from your organization' });
    }

    const sharedResource = await prisma.$transaction(async (tx) => {
      const entry = await tx.sharedResource.create({
        data: {
          resourceType: ResourceType.TICKET,
          ticketId: ticketId,
          sharedWithOrgId: String(targetOrgId),
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId: userId,
          action: 'CROSS_ORG_TICKET_SHARED',
          entityType: 'TICKET',
          entityId: ticketId,
          metadata: { sharedWithOrgId: targetOrgId },
        },
      });

      return entry;
    });

    res.status(201).json({ message: 'Ticket shared successfully', sharedResource });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share ticket' });
  }
});

export default router;