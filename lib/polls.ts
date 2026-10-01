import { BallotVisibility, PollMode, PollStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function canVote(userId: string, pollId: string) {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: { options: true }
  });

  if (!poll || poll.status !== PollStatus.OPEN) {
    return { ok: false as const, reason: "Votazione non aperta", poll };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    return { ok: false as const, reason: "Utente non avente diritto", poll };
  }

  if (poll.mode === PollMode.IN_PERSON) {
    if (!poll.meetingId) {
      return { ok: false as const, reason: "Seduta non collegata", poll };
    }

    const attendance = await db.attendance.findUnique({
      where: { meetingId_userId: { meetingId: poll.meetingId, userId } }
    });

    if (!attendance?.present) {
      return { ok: false as const, reason: "Non risulti presente alla seduta", poll };
    }
  }

  const alreadyVoted =
    poll.visibility === BallotVisibility.NAMED
      ? !!(await db.namedVote.findUnique({
          where: { pollId_userId: { pollId, userId } }
        }))
      : !!(await db.secretParticipation.findUnique({
          where: { pollId_userId: { pollId, userId } }
        }));

  if (alreadyVoted) {
    return { ok: false as const, reason: "Hai già votato", poll };
  }

  return { ok: true as const, reason: null, poll };
}
