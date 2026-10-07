import { randomInt, randomUUID } from "node:crypto";
import { db } from "@/lib/db";

/** Giorno (UTC) senza ora: la partecipazione indica "quando" solo a livello di giornata. */
export function votingDay(date = new Date()) {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/**
 * Rimescola le schede segrete di una votazione: le riscrive in ordine casuale con id nuovi.
 *
 * Senza questo passaggio l'ordine fisico delle righe nel database coinciderebbe con l'ordine
 * in cui le persone hanno votato, e in una votazione con pochi voti basterebbe confrontarlo con
 * l'ordine delle partecipazioni per risalire a chi ha scelto cosa.
 *
 * Si riscrivono solo le schede lette all'inizio: un voto arrivato nel frattempo non viene toccato.
 */
export async function reshuffleSecretBallots(pollId: string) {
  await db.$transaction(async (tx) => {
    const ballots = await tx.secretBallot.findMany({
      where: { pollId },
      select: { id: true, optionId: true }
    });

    if (ballots.length === 0) return;

    for (let i = ballots.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [ballots[i], ballots[j]] = [ballots[j], ballots[i]];
    }

    await tx.secretBallot.deleteMany({
      where: { id: { in: ballots.map((ballot) => ballot.id) } }
    });

    await tx.secretBallot.createMany({
      data: ballots.map((ballot) => ({
        id: randomUUID(),
        pollId,
        optionId: ballot.optionId
      }))
    });
  });
}
