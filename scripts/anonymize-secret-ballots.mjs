// Da eseguire una volta sola sui voti segreti già registrati prima di questa modifica:
//
//   npm run anonymize:secret
//
// Per ogni votazione segreta CHIUSA:
//   - riscrive le schede in ordine casuale con id nuovi (casuali, non ordinabili nel tempo);
// poi, su tutte le partecipazioni segrete:
//   - riduce l'orario del voto alla sola giornata;
// e nel registro:
//   - elimina le righe VOTE_SECRET_PARTICIPATION, che riportavano l'ora esatta di ogni partecipazione.
//
// Le votazioni segrete ancora aperte non vengono toccate (le schede si rimescolano alla chiusura).

import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const polls = await prisma.poll.findMany({
    where: { visibility: "SECRET", status: "CLOSED" },
    select: { id: true, title: true }
  });

  let shuffled = 0;

  for (const poll of polls) {
    await prisma.$transaction(async (tx) => {
      const ballots = await tx.secretBallot.findMany({
        where: { pollId: poll.id },
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
          pollId: poll.id,
          optionId: ballot.optionId
        }))
      });

      shuffled += ballots.length;
    });

    console.log(`Rimescolata: ${poll.title}`);
  }

  const days = await prisma.$executeRawUnsafe(
    `UPDATE "SecretParticipation" SET "votedAt" = date_trunc('day', "votedAt")`
  );

  const audit = await prisma.auditLog.deleteMany({
    where: { action: "VOTE_SECRET_PARTICIPATION" }
  });

  console.log(
    `Fatto: ${polls.length} votazioni, ${shuffled} schede riscritte, ` +
      `${days} partecipazioni ridotte alla giornata, ${audit.count} righe di registro eliminate.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
