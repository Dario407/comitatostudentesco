import { db } from "@/lib/db";

/** Dopo quanti giorni il codice di accesso va cambiato. */
export const CODE_MAX_AGE_DAYS = 90;

export type CodeChangeReason = "first" | "expired";

/**
 * Dice se l'utente deve scegliere un nuovo codice prima di continuare.
 * Lo stato si ricava dal registro: nessuna colonna in più nel database.
 *  - "first": il codice gli è stato assegnato da un amministratore e non l'ha ancora cambiato;
 *  - "expired": l'ultimo codice scelto ha più di CODE_MAX_AGE_DAYS giorni (per chi non ha
 *    storico vale la data di creazione dell'account).
 */
export async function codeChangeRequired(user: {
  id: string;
  createdAt: Date;
}): Promise<CodeChangeReason | null> {
  const last = await db.auditLog.findFirst({
    where: { targetType: "USER", targetId: user.id, action: { in: ["CODE_ISSUED", "CODE_CHANGED"] } },
    orderBy: { createdAt: "desc" },
    select: { action: true, createdAt: true }
  });

  if (last?.action === "CODE_ISSUED") return "first";

  const since = last?.createdAt ?? user.createdAt;
  const ageDays = (Date.now() - since.getTime()) / 86_400_000;
  return ageDays > CODE_MAX_AGE_DAYS ? "expired" : null;
}
