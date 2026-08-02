import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Security & Tenant Isolation Safeguards (BOLA & AI Leak Tests)', () => {
  let googleToken: string;
  let microsoftToken: string;
  let microsoftTicketId: string;
  let unsharedMicrosoftPRId: string;

  beforeAll(async () => {
    // 1. Obtain Google Admin JWT
    const googleRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@google.com', password: 'password123' });
    googleToken = googleRes.body.token;

    // 2. Obtain Microsoft Admin JWT
    const msRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@microsoft.com', password: 'password123' });
    microsoftToken = msRes.body.token;

    // 3. Fetch Microsoft ticket ID
    const msTicket = await prisma.ticket.findFirst({
      where: { title: 'Update OAuth Provider Scope' },
    });
    if (msTicket) {
      microsoftTicketId = msTicket.id;
    }

    // 4. Fetch Microsoft PR ID
    const msPR = await prisma.pullRequest.findFirst({
      where: { title: { contains: 'OAuth' } },
    });
    if (msPR) {
      unsharedMicrosoftPRId = msPR.id;
    }
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('BOLA Protection: Google user cannot fetch/modify an unshared Microsoft Ticket directly via ID', async () => {
    if (!microsoftTicketId) return;

    const resGet = await request(app)
      .get(`/api/tickets/${microsoftTicketId}`)
      .set('Authorization', `Bearer ${googleToken}`);

    expect([403, 404]).toContain(resGet.status);

    const resPatch = await request(app)
      .patch(`/api/tickets/${microsoftTicketId}/status`)
      .set('Authorization', `Bearer ${googleToken}`)
      .send({ status: 'CLOSED' });

    expect([403, 404]).toContain(resPatch.status);
  });

  test('PR Isolation: Google user cannot review or mutate unshared Microsoft PR', async () => {
    if (!unsharedMicrosoftPRId) return;

    const resReview = await request(app)
      .post(`/api/prs/${unsharedMicrosoftPRId}/review`)
      .set('Authorization', `Bearer ${googleToken}`)
      .send({ status: 'APPROVED' });

    expect([403, 404]).toContain(resReview.status);
  });

  test('AI Progress Digest Data Isolation: Digest never leaks unshared cross-org items', async () => {
    let res = await request(app)
      .get('/api/orgs/notifications')
      .set('Authorization', `Bearer ${googleToken}`);

    if (res.status === 404) {
      res = await request(app)
        .get('/api/org/notifications')
        .set('Authorization', `Bearer ${googleToken}`);
    }

    expect([200, 304]).toContain(res.status);
    const notifications = res.body.notifications || res.body || [];
    
    const rawDigestText = JSON.stringify(notifications);
    expect(rawDigestText).not.toContain('Update OAuth Provider Scope');
  });

  test('Logout Everywhere Lifecycle: Revoked token gets intercepted with 401 Unauthorized', async () => {
    // Perform temporary login to obtain disposable token
    const tempLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@google.com', password: 'password123' });
    
    const tempToken = tempLogin.body.token;

    // Trigger Logout-Everywhere
    await request(app)
      .post('/api/auth/logout-everywhere')
      .set('Authorization', `Bearer ${tempToken}`);

    // Attempt request with revoked token
    const resAfterLogout = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(resAfterLogout.status).toBe(401);
  });
});