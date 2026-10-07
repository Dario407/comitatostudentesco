import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BallotVisibility, PollMode, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/datetime";
import { describeOutcome, evaluatePoll } from "@/lib/quorum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helvetica standard copre le lettere accentate ma non ogni simbolo: il resto diventa "?".
function safe(text: string) {
  return text.replace(/[^ -~ -ÿ]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireInstituteRep();
    const { id } = await context.params;

    const meeting = await db.meeting.findUnique({
      where: { id },
      include: {
        attendance: { include: { user: true } },
        polls: {
          orderBy: { createdAt: "asc" },
          include: {
            options: { orderBy: { position: "asc" } },
            namedVotes: { include: { user: true } },
            participation: true,
            secretBallots: true
          }
        }
      }
    });

    if (!meeting) return NextResponse.json({ error: "Seduta non trovata" }, { status: 404 });

    const allReps = await db.user.findMany({
      where: { active: true, deletedAt: null, role: { in: [Role.CLASS_REP, Role.INSTITUTE_REP] } },
      orderBy: [{ className: "asc" }, { lastName: "asc" }]
    });

    const presentIds = new Set(
      meeting.attendance.filter((item) => item.present).map((item) => item.userId)
    );
    const present = allReps.filter((user) => presentIds.has(user.id));
    const absent = allReps.filter((user) => !presentIds.has(user.id));

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const W = 595.28;
    const H = 841.89;
    const margin = 52;
    const width = W - margin * 2;
    const ink = rgb(0.043, 0.122, 0.227);
    const muted = rgb(0.33, 0.4, 0.5);

    let page: PDFPage = pdf.addPage([W, H]);
    let y = H - margin;

    function ensure(height: number) {
      if (y - height < margin) {
        page = pdf.addPage([W, H]);
        y = H - margin;
      }
    }

    function text(value: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) {
      const size = opts.size ?? 10;
      const font = opts.font ?? regular;
      const indent = opts.indent ?? 0;
      for (const row of wrap(value, font, size, width - indent)) {
        ensure(size + 4);
        page.drawText(row, { x: margin + indent, y: y - size, size, font, color: opts.color ?? ink });
        y -= size + 4;
      }
      y -= opts.gap ?? 0;
    }

    function rule() {
      ensure(10);
      page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: W - margin, y: y - 4 }, thickness: 0.6, color: rgb(0.85, 0.88, 0.93) });
      y -= 12;
    }

    text("Comitato Studentesco", { size: 10, font: bold, color: muted });
    text("Verbale della seduta", { size: 22, font: bold, gap: 4 });
    text(meeting.title, { size: 14, font: bold });
    text(formatDateTime(meeting.startsAt, { dateStyle: "full", timeStyle: "short" }), { color: muted, gap: 6 });
    rule();

    text("Presenze", { size: 13, font: bold, gap: 2 });
    text(present.length + " presenti su " + allReps.length + " aventi diritto.", { gap: 4 });
    text("Presenti", { font: bold });
    text(present.length ? present.map((u) => u.lastName + " " + u.firstName + " (" + u.className + ")").join(", ") : "Nessuno.", { size: 9, gap: 4 });
    text("Assenti", { font: bold });
    text(absent.length ? absent.map((u) => u.lastName + " " + u.firstName + " (" + u.className + ")").join(", ") : "Nessuno.", { size: 9, gap: 6 });
    rule();

    text("Votazioni", { size: 13, font: bold, gap: 4 });

    if (meeting.polls.length === 0) text("Nessuna votazione collegata a questa seduta.");

    for (const poll of meeting.polls) {
      const secret = poll.visibility === BallotVisibility.SECRET;
      const voterIds = new Set(
        secret ? poll.participation.map((v) => v.userId) : poll.namedVotes.map((v) => v.userId)
      );
      const entitled =
        poll.mode === PollMode.IN_PERSON ? present : allReps;
      const eligibleIds = new Set(entitled.map((u) => u.id));
      voterIds.forEach((uid) => eligibleIds.add(uid));

      const counts = poll.options.map((option) => ({
        label: option.label,
        count: secret
          ? poll.secretBallots.filter((b) => b.optionId === option.id).length
          : poll.namedVotes.filter((v) => v.optionId === option.id).length
      }));

      const closed = poll.status === "CLOSED";
      const evaluation = evaluatePoll(eligibleIds.size, voterIds.size, counts);

      ensure(80);
      text(poll.title, { size: 12, font: bold });
      text(
        (secret ? "Voto segreto" : "Voto palese") + " - " +
          (poll.mode === PollMode.IN_PERSON ? "in presenza" : "asincrono") + " - " +
          (poll.status === "OPEN" ? "aperta" : poll.status === "CLOSED" ? "chiusa" : "bozza"),
        { size: 9, color: muted }
      );
      if (poll.description) text(poll.description, { size: 9, color: muted });
      text(
        "Hanno votato " + voterIds.size + " su " + eligibleIds.size + " aventi diritto (quorum " + evaluation.required + ").",
        { gap: 2 }
      );

      for (const item of counts) {
        text(item.label + ": " + item.count, { indent: 10 });
        if (!secret) {
          const names = poll.namedVotes
            .filter((v) => poll.options.find((o) => o.label === item.label)?.id === v.optionId)
            .map((v) => v.user.lastName + " " + v.user.firstName)
            .sort();
          if (names.length) text(names.join(", "), { size: 8, color: muted, indent: 20 });
        }
      }

      text("Esito: " + describeOutcome(evaluation, closed), { font: bold, gap: 8 });
    }

    ensure(40);
    rule();
    text("Documento generato il " + formatDateTime(new Date()) + " dal portale del Comitato.", { size: 8, color: muted });

    const file = Buffer.from(await pdf.save());
    const date = meeting.startsAt.toISOString().slice(0, 10);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="verbale-' + date + '.pdf"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const forbidden = msg === "FORBIDDEN" || msg === "UNAUTHORIZED";
    return NextResponse.json(
      { error: forbidden ? "Non autorizzato" : "Impossibile creare il verbale" },
      { status: forbidden ? 403 : 500 }
    );
  }
}
