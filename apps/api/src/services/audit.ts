import type { Db } from '../db/pool';

export async function audit(
  db: Db,
  e: { competitionId: string; actorId: string; entity: string; entityId?: string; action: string; before?: unknown; after?: unknown },
) {
  await db.query(
    `INSERT INTO audit_log (competition_id, actor_id, entity, entity_id, action, before, after) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [e.competitionId, e.actorId, e.entity, e.entityId ?? null, e.action, JSON.stringify(e.before ?? null), JSON.stringify(e.after ?? null)],
  );
}
