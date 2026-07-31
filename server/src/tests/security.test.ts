import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Security & Tenant Isolation Safeguards (BOLA & AI Leak Tests)', () => {
  let googleToken: string;
  let microsoftToken: string;
  let microsoftTicketId: string;

  // 30000ms (30 sec) timeout added to beforeAll
  beforeAll(async () => {
    // Obtain Google Admin JWT
    const googleRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@google.com', password: 'password123' });
    googleToken = googleRes.body.token;

    // Obtain Microsoft Admin JWT
    const msRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@microsoft.com', password: 'password123' });
    microsoftToken = msRes.body.token;

    // Fetch Microsoft ticket ID
    const msTicket = await prisma.ticket.findFirst({
      where: { title: 'Update OAuth Provider Scope' },
    });
    microsoftTicketId = msTicket!.id;
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('BOLA Protection: Google user cannot fetch/modify an unshared Microsoft Ticket directly via ID', async () => {
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

  test('AI Progress Digest Data Isolation: Digest never leaks unshared cross-org items', async () => {
    const res = await request(app)
      .get('/api/org/notifications') // Fixed route path: '/api/org'
      .set('Authorization', `Bearer ${googleToken}`);

    // Fallback check if route is /api/tickets or /api/org/notifications
    expect([200, 304]).toContain(res.status);
    const notifications = res.body.notifications || res.body || [];
    
    const rawDigestText = JSON.stringify(notifications);
    expect(rawDigestText).not.toContain('Update OAuth Provider Scope');
  });
});