import prisma from '../config/prisma';

export interface AuditEventParams {
  userId?: string;
  action: string;
  entityType: 'CONTACT' | 'USER' | 'IMPORT' | 'SYSTEM' | 'GOOGLE_SYNC';
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAuditEvent(params: AuditEventParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        details: params.details || {},
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
