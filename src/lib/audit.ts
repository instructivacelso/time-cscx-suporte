import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export async function recordAudit(input: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  metadata?: unknown;
  ip?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: (input.metadata as never) ?? null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    // Auditoria nunca deve derrubar a operação principal.
    console.error('[audit] falha ao registrar', err);
  }
}
