export type ImportRow = {
  firstName: string;
  lastName: string;
  className: string;
  phone: string;
  role?: "CLASS_REP" | "INSTITUTE_REP";
  accessCode?: string;
};

const HEADERS: Record<string, keyof ImportRow> = {
  first_name: "firstName", nome: "firstName",
  last_name: "lastName", cognome: "lastName",
  class_name: "className", classe: "className",
  phone: "phone", telefono: "phone", numero: "phone",
  role: "role", ruolo: "role",
  access_code: "accessCode", codice: "accessCode"
};

function parseRole(value: string): ImportRow["role"] {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if (v.startsWith("inst") || v.startsWith("ist")) return "INSTITUTE_REP";
  return "CLASS_REP";
}

/** Legge un CSV con separatore ; o , e intestazione facoltativa (italiana o inglese). */
export function parseMembersCsv(text: string): ImportRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, ""));

  const first = split(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = first.some((cell) => cell in HEADERS);
  const order: (keyof ImportRow)[] = hasHeader
    ? first.map((cell) => HEADERS[cell]).filter(Boolean) as (keyof ImportRow)[]
    : ["firstName", "lastName", "className", "phone", "role", "accessCode"];
  const columns = hasHeader ? first.map((cell) => HEADERS[cell]) : order;

  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    columns.forEach((key, index) => {
      if (key) row[key] = cells[index] ?? "";
    });
    return {
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      className: row.className ?? "",
      phone: row.phone ?? "",
      role: parseRole(row.role ?? ""),
      accessCode: row.accessCode || undefined
    };
  });
}
