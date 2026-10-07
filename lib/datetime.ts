/**
 * Date e orari del Comitato sono sempre in ora italiana, indipendentemente dal fuso del
 * browser di chi li inserisce e da quello del server (su Vercel è UTC).
 */
export const TIME_ZONE = "Europe/Rome";

export function formatDateTime(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
) {
  return new Intl.DateTimeFormat("it-IT", { ...options, timeZone: TIME_ZONE }).format(
    new Date(value)
  );
}

function romeOffsetMinutes(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  return (wallAsUtc - Math.floor(utcMs / 1000) * 1000) / 60000;
}

/** Converte il valore di un campo datetime-local ("2026-10-12T15:00"), letto come ora italiana, in ISO UTC. */
export function romeLocalToISO(local: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) throw new Error("Data non valida");

  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);

  // Due passaggi: il secondo corregge i casi a cavallo del cambio dell'ora legale.
  let utc = wall - romeOffsetMinutes(wall) * 60000;
  utc = wall - romeOffsetMinutes(utc) * 60000;

  return new Date(utc).toISOString();
}
