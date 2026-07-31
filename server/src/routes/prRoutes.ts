import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { PRStatus, ResourceType } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

// 1. GET ALL PRS (Active Org Scope + Shared PRs with Owner Organization)
router.get('/', async (req: AuthRequest, res: Response) => {
  const activeOrgId = req.user!.activeOrgId;

  try {
    const ownPRs = await prisma.pullRequest.findMany({
      where: { orgId: activeOrgId },
      include: {
        reviews: { include: { reviewer: { select: { fullName: true, email: true } } } },
        versions: { orderBy: { versionNumber: 'desc' } },
        organization: { select: { id: true, name: true } },
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
          include: {
            reviews: { include: { reviewer: { select: { fullName: true, email: true } } } },
            versions: { orderBy: { versionNumber: 'desc' } },
            organization: { select: { id: true, name: true } }, // 👈 Includes source org name
          },
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
    console.error('Error retrieving PRs:', error);
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
    console.error('Error creating PR:', error);
    res.status(500).json({ error: 'Failed to create pull request' });
  }
});

// 3. SHARE PR WITH PARTNER ORG
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  const prId = req.params.id as string;
  const { targetOrgId } = req.body;
  const { userId, activeOrgId } = req.user!;

  if (!targetOrgId) {
    return res.status(400).json({ error: 'Target Organization ID is required' });
  }

  try {
    const pr = await prisma.pullRequest.findUnique({ where: { id: prId } });
    if (!pr || pr.orgId !== activeOrgId) {
      return res.status(403).json({ error: 'Access denied or PR not found' });
    }

    // 1. Existing share record check
    const existingShare = await prisma.sharedResource.findFirst({
      where: {
        prId: prId,
        sharedWithOrgId: targetOrgId,
      },
    });

    if (existingShare) {
      return res.json({ message: 'PR is already shared with this organization', shareRecord: existingShare });
    }

    // 2. Create Shared Resource record
    const shareRecord = await prisma.$transaction(async (tx) => {
      const shared = await tx.sharedResource.create({
        data: {
          resourceType: ResourceType.PR,
          prId: prId,
          sharedWithOrgId: targetOrgId,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: activeOrgId,
          userId,
          action: 'PR_SHARED',
          entityType: 'PR',
          entityId: prId,
          metadata: { sharedWithOrgId: targetOrgId },
        },
      });

      return shared;
    });

    return res.status(201).json({ message: 'PR shared successfully', shareRecord });
  } catch (error: any) {
    console.error('❌ Share PR Error:', error);
    return res.status(500).json({ error: 'Failed to share PR', details: error?.message });
  }
});

// 4. SUBMIT A REVIEW
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

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.pRReview.create({
        data: {
          prId,
          reviewerId: userId,
          status: status as PRStatus,
          comment: comment ? String(comment) : null,
        },
      });

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
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// 5. PUSH NEW VERSION
router.post('/:id/version', async (req: AuthRequest, res: Response) => {
  const prId = req.params.id as string;
  const { title, description, diff } = req.body;
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

    const updatedPr = await prisma.$transaction(async (tx) => {
      const updated = await tx.pullRequest.update({
        where: { id: prId },
        data: {
          title: title ? String(title) : pr.title,
          description: description ? String(description) : pr.description,
          status: PRStatus.IN_REVIEW,
        },
      });

      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: nextVersionNumber,
          title: title ? String(title) : pr.title,
          description: description ? String(description) : pr.description,
          diff: diff ? String(diff) : 'Updated version diff',
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

    res.json({ message: 'PR version updated successfully', pr: updatedPr });
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Failed to push new PR version' });
  }
});

export default router;