import { db } from "@/lib/db";
import { DEFAULT_QUORUM, type QuorumBase, type QuorumSettings } from "@/lib/quorum";

/*
  Impostazioni del quorum di ogni votazione. Per non richiedere una migrazione del database
  sono conservate nel registro: vale l'ultima voce POLL_QUORUM della votazione.
*/
const ACTION = "POLL_QUORUM";

export async function loadQuorumSettings(pollIds: string[]) {
  const map = new Map<string, QuorumSettings>();
  if (pollIds.length === 0) return map;

  const rows = await db.auditLog.findMany({
    where: { action: ACTION, targetType: "POLL", targetId: { in: pollIds } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, metadata: true }
  });

  for (const row of rows) {
    if (!row.targetId || map.has(row.targetId)) continue;
    const meta = row.metadata as { percent?: number | null; base?: QuorumBase } | null;
    map.set(row.targetId, {
      percent: typeof meta?.percent === "number" ? meta.percent : null,
      base: meta?.base === "PRESENT" ? "PRESENT" : "MEMBERS"
    });
  }
  return map;
}

export async function loadQuorumSetting(pollId: string) {
  return (await loadQuorumSettings([pollId])).get(pollId) ?? DEFAULT_QUORUM;
}

export async function saveQuorumSettings(pollId: string, actorId: string, settings: QuorumSettings) {
  await db.auditLog.create({
    data: {
      actorId,
      action: ACTION,
      targetType: "POLL",
      targetId: pollId,
      metadata: { percent: settings.percent, base: settings.base }
    }
  });
}
