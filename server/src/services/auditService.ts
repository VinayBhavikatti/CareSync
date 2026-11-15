import { PrismaClient, AuditActor } from '@prisma/client';

const prisma = new PrismaClient();

interface LogAuditParams {
  profileId: string;
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
}

export async function createAuditEntry(params: LogAuditParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        profileId: params.profileId,
        actor: params.actor,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
        after: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
        createdAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Failed to create audit entry:', err);
  }
}

