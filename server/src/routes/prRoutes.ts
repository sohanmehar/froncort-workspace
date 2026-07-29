import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { PRStatus, ResourceType } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// 1. GET ALL PRS (Active Org Scope + Shared PRs)
router.get('/', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;

  try {
    const ownPRs = await prisma.pullRequest.findMany({
      where: { orgId: activeOrgId },
      include: {
        reviews: { include: { reviewer: { select: { fullName: true, email: true } } } },
        versions: { orderBy: { versionNumber: 'desc' } },
        sharedEntries: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const sharedEntries = await prisma.sharedResource.findMany({
      where: {
        sharedWithOrgId: activeOrgId,
        resourceType: ResourceType.PR,
      },
      include: {
        pullRequest: {
          include: { reviews: true, versions: true },
        },
      },
    });

    const sharedPRs = sharedEntries
      .map((entry) => entry.pullRequest)
      .filter((pr) => pr !== null);

    res.json({
      prs: ownPRs,
      sharedPRs,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve pull requests' });
  }
});

// 2. CREATE PULL REQUEST + VERSION 1 + AUDIT LOG
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, description, requiredApprovals } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pr = await tx.pullRequest.create({
        data: {
          orgId: activeOrgId,
          title: String(title),
          description: String(description),
          authorId: userId,
          requiredApprovals: requiredApprovals ? Number(requiredApprovals) : 1,
          status: PRStatus.DRAFT,
        },
      });

      // Create Initial Version (Version 1)
      await tx.pRVersion.create({
        data: {
          prId: pr.id,
          versionNumber: 1,
          title: pr.title,
          description: pr.description,
          diff: 'Initial PR creation',
        },
      });

      // Append Audit Log
      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId,
          action: 'PR_CREATED',
          entityType: 'PR',
          entityId: pr.id,
          metadata: { title: pr.title },
        },
      });

      return pr;
    });

    res.status(201).json({ message: 'Pull Request created successfully', pr: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pull request' });
  }
});

// 3. SUBMIT A REVIEW (Approve / Reject / Changes Requested)
router.post('/:id/review', async (req: AuthRequest, res: Response) => {
  const prId = req.params.id as string;
  const { status, comment } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid review status' });
  }

  try {
    const pr = await prisma.pullRequest.findUnique({
      where: { id: prId },
      include: { reviews: true },
    });

    if (!pr) {
      return res.status(404).json({ error: 'Pull Request not found' });
    }

    if (pr.orgId !== activeOrgId) {
      return res.status(403).json({ error: 'Forbidden: Cannot review external organization PR' });
    }

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.pRReview.create({
        data: {
          prId,
          reviewerId: userId,
          status: status as PRStatus,
          comment: comment ? String(comment) : null,
        },
      });

      // Count approvals
      const currentReviews = await tx.pRReview.findMany({ where: { prId } });
      const approvalCount = currentReviews.filter((r) => r.status === 'APPROVED').length;

      let newPrStatus = pr.status;
      if (status === 'CHANGES_REQUESTED') {
        newPrStatus = PRStatus.CHANGES_REQUESTED;
      } else if (approvalCount >= pr.requiredApprovals) {
        newPrStatus = PRStatus.APPROVED;
      } else {
        newPrStatus = PRStatus.IN_REVIEW;
      }

      await tx.pullRequest.update({
        where: { id: prId },
        data: { status: newPrStatus },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId,
          action: `PR_REVIEW_${status}`,
          entityType: 'PR',
          entityId: prId,
          metadata: { comment },
        },
      });

      return newReview;
    });

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// 4. EDIT PR (Creates New Version + Diff)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const prId = req.params.id as string;
  const { title, description } = req.body;
  const { userId, activeOrgId } = req.user!;

  try {
    const pr = await prisma.pullRequest.findUnique({
      where: { id: prId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!pr || pr.orgId !== activeOrgId) {
      return res.status(403).json({ error: 'Access denied or PR not found' });
    }

    const latestVersion = pr.versions[0]?.versionNumber || 1;
    const nextVersionNumber = latestVersion + 1;

    const diffText = `Updated Title: "${pr.title}" -> "${title}". Updated Description.`;

    const updatedPr = await prisma.$transaction(async (tx) => {
      const updated = await tx.pullRequest.update({
        where: { id: prId },
        data: {
          title: String(title),
          description: String(description),
          status: PRStatus.IN_REVIEW,
        },
      });

      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: nextVersionNumber,
          title: String(title),
          description: String(description),
          diff: diffText,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId,
          action: 'PR_NEW_VERSION_CREATED',
          entityType: 'PR',
          entityId: prId,
          metadata: { version: nextVersionNumber },
        },
      });

      return updated;
    });

    res.json({ message: 'PR updated and new version created', pr: updatedPr });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update PR' });
  }
});

export default router;