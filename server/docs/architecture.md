# System & Identity Architecture

## Overview
Froncort is a multi-tenant unified workspace designed to support multi-organization collaboration, automated audit logging, and AI-driven status digests while maintaining strict data isolation.

## Security & Tenant Isolation
1. **Multi-Tenant JWT Claims**: Authentication tokens contain `orgId` and `role` claims to enforce strict tenant boundary checks across all REST endpoints.
2. **Query-Level Data Scoping**: All Prisma database operations enforce explicit `where: { orgId }` clauses, preventing BOLA (Broken Object Level Authorization) vulnerabilities.
3. **Cross-Org Progress Digest**: AI/Notification digests query only the logged-in user's scoped organization data to prevent cross-tenant data leakage.

## Database Immutability
- **Append-Only Audit Logs**: Enforced at the PostgreSQL level using a custom database trigger (`audit_log_immutable_trigger`). Any direct or indirect `UPDATE` or `DELETE` attempt on the `AuditLog` table is aborted by the database engine.