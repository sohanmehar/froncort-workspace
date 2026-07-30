import { PrismaClient, Role, TicketStatus, PRStatus, ConnectionStatus, ResourceType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function applyAuditTrigger() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted!';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'audit_log_immutable_trigger'
      ) THEN
        CREATE TRIGGER audit_log_immutable_trigger
        BEFORE UPDATE OR DELETE ON "AuditLog"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_modification();
      END IF;
    END $$;
  `);

  console.log('✅ PostgreSQL Append-Only Audit Trigger Active!');
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Clean existing data (Ignoring immutable auditLog deletion errors)
  try {
    await prisma.sharedResource.deleteMany();
    await prisma.orgConnection.deleteMany();
    await prisma.ticketComment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.pRReview.deleteMany();
    await prisma.pRVersion.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  } catch (err) {
    console.log('⚠️ Skipping immutable relational constraints clean-up...');
  }

  // Attempt audit log cleanup safely without crashing if trigger exists
  try {
    await prisma.auditLog.deleteMany();
  } catch (e) {
    console.log('ℹ️ AuditLog table is append-only protected (skipping deletion).');
  }

  // 2. Create or Get Organizations (Upsert to prevent domain collisions)
  const google = await prisma.organization.upsert({
    where: { domain: 'google.com' },
    update: { name: 'Google' },
    create: { name: 'Google', domain: 'google.com' },
  });

  const microsoft = await prisma.organization.upsert({
    where: { domain: 'microsoft.com' },
    update: { name: 'Microsoft' },
    create: { name: 'Microsoft', domain: 'microsoft.com' },
  });

  // 3. Create or Get Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const john = await prisma.user.upsert({
    where: { email: 'john@google.com' },
    update: { fullName: 'John Doe (Admin)', passwordHash },
    create: { email: 'john@google.com', fullName: 'John Doe (Admin)', passwordHash },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@google.com' },
    update: { fullName: 'Alice Smith (Reviewer)', passwordHash },
    create: { email: 'alice@google.com', fullName: 'Alice Smith (Reviewer)', passwordHash },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@google.com' },
    update: { fullName: 'Charlie Agent (Support)', passwordHash },
    create: { email: 'agent@google.com', fullName: 'Charlie Agent (Support)', passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@microsoft.com' },
    update: { fullName: 'Bob Wilson (Partner Admin)', passwordHash },
    create: { email: 'bob@microsoft.com', fullName: 'Bob Wilson (Partner Admin)', passwordHash },
  });

  // 4. Create Memberships with clear Role hierarchy
  await prisma.membership.deleteMany();

  await prisma.membership.createMany({
    data: [
      { userId: john.id, orgId: google.id, role: Role.ORG_ADMIN },
      { userId: alice.id, orgId: google.id, role: Role.REVIEWER },
      { userId: agent.id, orgId: google.id, role: Role.SUPPORT_AGENT },
      { userId: bob.id, orgId: microsoft.id, role: Role.ORG_ADMIN },
    ],
  });

  // 5. Create Org Connection (Google <-> Microsoft)
  await prisma.orgConnection.create({
    data: {
      initiatorOrgId: google.id,
      receiverOrgId: microsoft.id,
      status: ConnectionStatus.ACCEPTED,
    },
  });

  // 6. Create Tickets for Google
  const ticket1 = await prisma.ticket.create({
    data: {
      orgId: google.id,
      title: 'Fix Auth Session Sync Bug',
      description: 'Session cookie expires prematurely on dashboard switcher.',
      status: TicketStatus.OPEN,
      createdById: john.id,
      assignedToId: alice.id,
    },
  });

  await prisma.ticket.create({
    data: {
      orgId: google.id,
      title: 'Optimize Database Indexing',
      description: 'Audit log query latency is above 200ms.',
      status: TicketStatus.IN_PROGRESS,
      createdById: alice.id,
    },
  });

  // 7. Create Tickets for Microsoft
  await prisma.ticket.create({
    data: {
      orgId: microsoft.id,
      title: 'Update OAuth Provider Scope',
      description: 'Add offline_access scope to Azure auth flow.',
      status: TicketStatus.OPEN,
      createdById: bob.id,
    },
  });

  // 8. Create Pull Request for Google
  const pr1 = await prisma.pullRequest.create({
    data: {
      orgId: google.id,
      title: 'feat: add unified JWT identity middleware',
      description: 'Implements cross-dashboard JWT token validation.',
      status: PRStatus.IN_REVIEW,
      authorId: john.id,
      requiredApprovals: 1,
    },
  });

  await prisma.pRVersion.create({
    data: {
      prId: pr1.id,
      versionNumber: 1,
      title: 'feat: add unified JWT identity middleware',
      description: 'Initial draft for identity middleware.',
      diff: '--- old/auth.ts\n+++ new/auth.ts\n@@ -1,3 +1,5 @@\n+ export const verifyToken = () => {};',
    },
  });

  // 9. Cross-Org Sharing (Google shares Ticket 1 with Microsoft)
  await prisma.sharedResource.create({
    data: {
      resourceType: ResourceType.TICKET,
      ticketId: ticket1.id,
      sharedWithOrgId: microsoft.id,
    },
  });

  // 10. Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        orgId: google.id,
        userId: john.id,
        action: 'TICKET_CREATED',
        entityType: 'TICKET',
        entityId: ticket1.id,
        metadata: { title: ticket1.title },
      },
      {
        orgId: google.id,
        userId: john.id,
        action: 'CROSS_ORG_SHARE',
        entityType: 'TICKET',
        entityId: ticket1.id,
        metadata: { sharedWithOrgId: microsoft.id },
      },
    ],
  });

  await applyAuditTrigger();

  console.log('✅ Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('🔑 Sample Login Credentials for RBAC Evaluation:');
  console.log(' 1. Google Admin:      john@google.com   / password123 (Full Access)');
  console.log(' 2. Google Reviewer:   alice@google.com  / password123 (Full Access)');
  console.log(' 3. Google Agent:      agent@google.com  / password123 (Dashboard 1 Only - Restricted on PRs)');
  console.log(' 4. Microsoft Admin:   bob@microsoft.com / password123 (Partner Org Access)');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });