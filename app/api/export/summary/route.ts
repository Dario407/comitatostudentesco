import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  BallotVisibility,
  PollMode,
  Role
} from "@prisma/client";
import { NextResponse } from "next/server";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PollSummary = {
  title: string;
  description: string;
  mode: string;
  visibility: string;
  status: string;
  meeting: string;
  eligible: number;
  voted: number;
  nonVoters: number;
  participation: number;
  results: string;
};

function meetingStatus(status: string) {
  return status === "OPEN" ? "Aperta" : "Chiusa";
}

function pollStatus(status: string) {
  if (status === "OPEN") return "Aperta";
  if (status === "CLOSED") return "Chiusa";
  return "Bozza";
}

function pollMode(mode: string) {
  return mode === "IN_PERSON" ? "In presenza" : "Asincrono";
}

function pollVisibility(visibility: string) {
  return visibility === "SECRET" ? "Segreto" : "Palese";
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome"
  }).format(value);
}

async function loadSummary() {
  const [users, meetings, polls] = await Promise.all([
    db.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        role: { in: [Role.CLASS_REP, Role.INSTITUTE_REP] }
      },
      select: { id: true }
    }),
    db.meeting.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        attendance: {
          include: {
            user: {
              select: {
                id: true,
                active: true,
                deletedAt: true
              }
            }
          }
        },
        _count: {
          select: { polls: true }
        }
      }
    }),
    db.poll.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        meeting: {
          select: {
            id: true,
            title: true
          }
        },
        options: {
          orderBy: { position: "asc" }
        },
        namedVotes: {
          select: {
            userId: true,
            optionId: true
          }
        },
        participation: {
          select: {
            userId: true
          }
        },
        secretBallots: {
          select: {
            optionId: true
          }
        }
      }
    })
  ]);

  const activeUserIds = new Set(users.map((user) => user.id));

  const meetingRows = meetings.map((meeting) => {
    const presentIds = new Set(
      meeting.attendance
        .filter(
          (item) =>
            item.present &&
            item.user.active &&
            item.user.deletedAt === null &&
            activeUserIds.has(item.userId)
        )
        .map((item) => item.userId)
    );

    return {
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      status: meetingStatus(meeting.status),
      present: presentIds.size,
      absent: Math.max(0, users.length - presentIds.size),
      polls: meeting._count.polls,
      presentIds
    };
  });

  const meetingById = new Map(meetingRows.map((meeting) => [meeting.id, meeting]));

  const pollRows: PollSummary[] = polls.map((poll) => {
    const eligibleIds =
      poll.mode === PollMode.IN_PERSON && poll.meetingId
        ? meetingById.get(poll.meetingId)?.presentIds ?? new Set<string>()
        : activeUserIds;

    const voterIds = new Set(
      poll.visibility === BallotVisibility.NAMED
        ? poll.namedVotes.map((vote) => vote.userId)
        : poll.participation.map((vote) => vote.userId)
    );

    const eligibleVoters = [...voterIds].filter((id) => eligibleIds.has(id)).length;
    const eligible = eligibleIds.size;
    const nonVoters = Math.max(0, eligible - eligibleVoters);
    const participation =
      eligible === 0 ? 0 : Math.round((eligibleVoters / eligible) * 100);

    const results = poll.options
      .map((option) => {
        const count =
          poll.visibility === BallotVisibility.NAMED
            ? poll.namedVotes.filter((vote) => vote.optionId === option.id).length
            : poll.secretBallots.filter((vote) => vote.optionId === option.id).length;

        const total =
          poll.visibility === BallotVisibility.NAMED
            ? poll.namedVotes.length
            : poll.secretBallots.length;

        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
        return option.label + ": " + count + " (" + percentage + "%)";
      })
      .join(" | ");

    return {
      title: poll.title,
      description: poll.description ?? "",
      mode: pollMode(poll.mode),
      visibility: pollVisibility(poll.visibility),
      status: pollStatus(poll.status),
      meeting: poll.meeting?.title ?? "-",
      eligible,
      voted: eligibleVoters,
      nonVoters,
      participation,
      results
    };
  });

  return { users, meetingRows, pollRows };
}

function styleWorksheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).height = 24;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F4C81" }
  };
  sheet.getRow(1).alignment = { vertical: "middle" };

  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.alignment = { vertical: "top", wrapText: true };

    row.eachCell((cell) => {
      cell.border = {
        bottom: {
          style: "thin",
          color: { argb: "FFE4EAF0" }
        }
      };
    });
  });

  if (sheet.rowCount > 1) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: sheet.columnCount }
    };
  }
}

async function buildExcel() {
  const { users, meetingRows, pollRows } = await loadSummary();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Comitato Studentesco";
  workbook.created = new Date();

  const overview = workbook.addWorksheet("Riepilogo");
  overview.addRow(["Riepilogo Comitato Studentesco", ""]);
  overview.addRow(["Generato il", dateTime(new Date())]);
  overview.addRow(["Rappresentanti attivi", users.length]);
  overview.addRow(["Sedute", meetingRows.length]);
  overview.addRow(["Votazioni", pollRows.length]);

  overview.getColumn(1).width = 30;
  overview.getColumn(2).width = 38;
  overview.getRow(1).font = { bold: true, size: 16, color: { argb: "FF0F4C81" } };
  overview.mergeCells("A1:B1");

  const meetingsSheet = workbook.addWorksheet("Sedute");
  meetingsSheet.addRow([
    "Titolo",
    "Data e ora",
    "Stato",
    "Presenti",
    "Assenti",
    "Votazioni collegate"
  ]);

  meetingRows.forEach((meeting) => {
    meetingsSheet.addRow([
      meeting.title,
      dateTime(meeting.startsAt),
      meeting.status,
      meeting.present,
      meeting.absent,
      meeting.polls
    ]);
  });

  styleWorksheet(meetingsSheet, [34, 22, 14, 12, 12, 20]);

  const pollsSheet = workbook.addWorksheet("Votazioni");
  pollsSheet.addRow([
    "Titolo",
    "Descrizione",
    "Modalita",
    "Tipo voto",
    "Stato",
    "Seduta",
    "Aventi diritto",
    "Hanno votato",
    "Non hanno votato",
    "Affluenza",
    "Risultati"
  ]);

  pollRows.forEach((poll) => {
    pollsSheet.addRow([
      poll.title,
      poll.description,
      poll.mode,
      poll.visibility,
      poll.status,
      poll.meeting,
      poll.eligible,
      poll.voted,
      poll.nonVoters,
      poll.participation / 100,
      poll.results
    ]);
  });

  pollsSheet.getColumn(10).numFmt = "0%";
  styleWorksheet(pollsSheet, [34, 42, 16, 14, 14, 30, 16, 16, 18, 14, 48]);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? line + " " + word : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = word;
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function buildPdf() {
  const { users, meetingRows, pollRows } = await loadSummary();

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;

  let page: PDFPage;
  let y: number;

  function newPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    return page;
  }

  function ensureSpace(height: number) {
    if (y - height < margin) newPage();
  }

  function line(
    text: string,
    options?: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      gap?: number;
    }
  ) {
    const size = options?.size ?? 10;
    const font = options?.font ?? regular;
    const color = options?.color ?? rgb(0.11, 0.15, 0.2);
    const gap = options?.gap ?? 4;
    const rows = wrapText(text, font, size, contentWidth);
    const height = rows.length * (size + 3) + gap;
    ensureSpace(height);

    for (const row of rows) {
      page.drawText(row, {
        x: margin,
        y,
        size,
        font,
        color
      });
      y -= size + 3;
    }

    y -= gap;
  }

  function separator() {
    ensureSpace(12);
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.7,
      color: rgb(0.87, 0.9, 0.94)
    });
    y -= 12;
  }

  newPage();

  line("Riepilogo Comitato Studentesco", {
    size: 20,
    font: bold,
    color: rgb(0.06, 0.3, 0.51),
    gap: 8
  });
  line("Generato il " + dateTime(new Date()), {
    size: 9,
    color: rgb(0.4, 0.46, 0.53),
    gap: 12
  });
  line(
    "Rappresentanti attivi: " +
      users.length +
      "   |   Sedute: " +
      meetingRows.length +
      "   |   Votazioni: " +
      pollRows.length,
    { size: 10, font: bold, gap: 18 }
  );

  line("SEDUTE", {
    size: 13,
    font: bold,
    color: rgb(0.06, 0.3, 0.51),
    gap: 10
  });

  if (meetingRows.length === 0) {
    line("Nessuna seduta registrata.", { size: 10, gap: 12 });
  }

  for (const meeting of meetingRows) {
    line(meeting.title, { size: 11, font: bold, gap: 3 });
    line("Data e ora: " + dateTime(meeting.startsAt), { size: 9, gap: 2 });
    line(
      "Stato: " +
        meeting.status +
        " | Presenti: " +
        meeting.present +
        " | Assenti: " +
        meeting.absent +
        " | Votazioni collegate: " +
        meeting.polls,
      { size: 9, gap: 7 }
    );
    separator();
  }

  ensureSpace(30);
  line("VOTAZIONI", {
    size: 13,
    font: bold,
    color: rgb(0.06, 0.3, 0.51),
    gap: 10
  });

  if (pollRows.length === 0) {
    line("Nessuna votazione registrata.", { size: 10, gap: 12 });
  }

  for (const poll of pollRows) {
    line(poll.title, { size: 11, font: bold, gap: 3 });

    if (poll.description) {
      line("Descrizione: " + poll.description, { size: 9, gap: 3 });
    }

    line(
      "Modalita: " +
        poll.mode +
        " | Tipo: " +
        poll.visibility +
        " | Stato: " +
        poll.status,
      { size: 9, gap: 2 }
    );

    line("Seduta: " + poll.meeting, { size: 9, gap: 2 });

    line(
      "Aventi diritto: " +
        poll.eligible +
        " | Hanno votato: " +
        poll.voted +
        " | Non hanno votato: " +
        poll.nonVoters +
        " | Affluenza: " +
        poll.participation +
        "%",
      { size: 9, gap: 2 }
    );

    line("Risultati: " + (poll.results || "Nessun voto registrato"), {
      size: 9,
      gap: 7
    });

    separator();
  }

  return Buffer.from(await pdf.save());
}

export async function GET(req: Request) {
  try {
    await requireInstituteRep();

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);

    if (format === "xlsx") {
      const file = await buildExcel();

      return new NextResponse(file, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="riepilogo-comitato-' + date + '.xlsx"',
          "Cache-Control": "no-store"
        }
      });
    }

    if (format === "pdf") {
      const file = await buildPdf();

      return new NextResponse(file, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="riepilogo-comitato-' + date + '.pdf"',
          "Cache-Control": "no-store"
        }
      });
    }

    return NextResponse.json(
      { error: "Formato non valido. Usa pdf o xlsx." },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    return NextResponse.json(
      {
        error:
          message === "FORBIDDEN"
            ? "Non autorizzato"
            : "Impossibile generare il riepilogo"
      },
      {
        status:
          message === "FORBIDDEN"
            ? 403
            : message === "UNAUTHORIZED"
              ? 401
              : 500
      }
    );
  }
}
