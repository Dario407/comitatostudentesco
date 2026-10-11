/**
 * Regole di validità di una votazione.
 *  - Quorum: percentuale di votanti sulla base scelta alla creazione, i membri totali oppure i
 *    soli presenti alla seduta. Senza impostazioni (votazioni create prima) vale "metà più uno
 *    dei membri totali".
 *  - Esito: maggioranza semplice tra "sì" e "no", gli altri (astenuti, ecc.) non contano.
 * Il verdetto approvata/respinta c'è solo se le opzioni sono riconoscibili come favorevole/contrario;
 * altrimenti si indica l'opzione in testa.
 */

const YES = /^(s[iì]|favorevol[ei]|d['’]?accordo|approv\w*)$/i;
const NO = /^(no|contrari[oe]|respin\w*)$/i;

export type QuorumBase = "MEMBERS" | "PRESENT";
/**
 * Maggioranza per l'approvazione:
 *  - EXPRESSED: semplice, più sì che no tra i voti espressi (predefinita);
 *  - PRESENT / MEMBERS: assoluta, i sì devono essere più della metà dei presenti / dei membri totali.
 */
export type MajorityKind = "EXPRESSED" | "PRESENT" | "MEMBERS";
export type QuorumSettings = { percent: number | null; base: QuorumBase; majority?: MajorityKind };

export const DEFAULT_QUORUM: QuorumSettings = { percent: null, base: "MEMBERS", majority: "EXPRESSED" };

export function majorityLabel(kind: MajorityKind | undefined) {
  if (kind === "PRESENT") return "maggioranza assoluta dei presenti";
  if (kind === "MEMBERS") return "maggioranza assoluta dei membri totali";
  return "maggioranza semplice dei voti espressi";
}

/** Sì necessari con maggioranza assoluta: più della metà della base. */
export function majorityRequired(base: number) {
  return Math.floor(base / 2) + 1;
}

export type QuorumResult = {
  required: number;
  base: number;
  reached: boolean;
  verdict: "APPROVED" | "REJECTED" | "BELOW" | "TIE" | "LEADING" | "NONE";
  leading: string | null;
  /** Sì necessari con maggioranza assoluta, altrimenti null. */
  yesNeeded: number | null;
};

export function quorumRequired(base: number, settings: QuorumSettings) {
  if (settings.percent === null) return base === 0 ? 0 : Math.floor(base / 2) + 1;
  if (settings.percent <= 0) return 0;
  // Il piccolo scarto evita che 50% di 30 diventi 16 per un errore di virgola mobile.
  return Math.min(base, Math.ceil((base * settings.percent) / 100 - 1e-9));
}

export function baseWord(base: QuorumBase) {
  return base === "PRESENT" ? "presenti" : "membri totali";
}

export function quorumLabel(settings: QuorumSettings) {
  if (settings.percent === null) return "metà più uno dei " + baseWord(settings.base);
  if (settings.percent <= 0) return "nessun quorum";
  return "almeno il " + settings.percent + "% dei " + baseWord(settings.base);
}

export function evaluatePoll(
  base: number,
  voted: number,
  counts: { label: string; count: number }[],
  settings: QuorumSettings = DEFAULT_QUORUM,
  majorityBase: number | null = null
): QuorumResult {
  const required = quorumRequired(base, settings);
  const reached =
    settings.percent !== null && settings.percent <= 0 ? true : base > 0 && voted >= required;

  const absolute = settings.majority === "PRESENT" || settings.majority === "MEMBERS";
  const yesNeeded = absolute && majorityBase !== null ? majorityRequired(majorityBase) : null;

  const yes = counts.find((item) => YES.test(item.label.trim()));
  const no = counts.find((item) => NO.test(item.label.trim()));

  if (yes && no && counts.length >= 2) {
    if (yesNeeded !== null) {
      // Maggioranza assoluta: contano i sì rispetto alla base, non il confronto con i no.
      if (yes.count >= yesNeeded) return { required, base, reached, verdict: "APPROVED", leading: yes.label, yesNeeded };
      return { required, base, reached, verdict: "BELOW", leading: null, yesNeeded };
    }
    if (yes.count === 0 && no.count === 0) return { required, base, reached, verdict: "NONE", leading: null, yesNeeded };
    if (yes.count === no.count) return { required, base, reached, verdict: "TIE", leading: null, yesNeeded };
    return {
      required,
      base,
      reached,
      verdict: yes.count > no.count ? "APPROVED" : "REJECTED",
      leading: yes.count > no.count ? yes.label : no.label,
      yesNeeded
    };
  }

  const top = Math.max(0, ...counts.map((item) => item.count));
  if (top === 0) return { required, base, reached, verdict: "NONE", leading: null, yesNeeded };
  const leaders = counts.filter((item) => item.count === top);
  return leaders.length > 1
    ? { required, base, reached, verdict: "TIE", leading: null, yesNeeded }
    : { required, base, reached, verdict: "LEADING", leading: leaders[0].label, yesNeeded };
}

/** Frase per schermo e verbale. `closed` distingue l'esito finale dalla situazione del momento. */
export function describeOutcome(result: QuorumResult, closed: boolean) {
  if (!result.reached) return closed ? "Quorum non raggiunto: votazione non valida" : "Quorum non ancora raggiunto";
  switch (result.verdict) {
    case "APPROVED":
      return closed ? "Approvata" : "Al momento approvata";
    case "REJECTED":
      return closed ? "Respinta" : "Al momento respinta";
    case "BELOW":
      return closed ? "Non approvata: maggioranza non raggiunta" : "Maggioranza non ancora raggiunta";
    case "TIE":
      return "Parità";
    case "LEADING":
      return (closed ? "Prevale " : "In testa: ") + result.leading;
    default:
      return "Nessun voto espresso";
  }
}

/**
 * Su quante persone si calcola il quorum. Senza impostazioni (votazioni precedenti) si resta
 * sugli aventi diritto. "Presenti" richiede una seduta collegata: senza, si ripiega sui membri.
 */
export function resolveQuorumBase(
  settings: QuorumSettings,
  counts: { members: number; present: number | null; eligible: number }
): { count: number; fallback: boolean } {
  if (settings.percent === null) return { count: counts.eligible, fallback: false };
  if (settings.base === "PRESENT") {
    return counts.present === null
      ? { count: counts.members, fallback: true }
      : { count: counts.present, fallback: false };
  }
  return { count: counts.members, fallback: false };
}

/** Base della maggioranza assoluta: presenti (o membri se non c'è seduta) oppure membri totali. */
export function resolveMajorityBase(
  kind: MajorityKind | undefined,
  counts: { members: number; present: number | null }
): number | null {
  if (kind === "MEMBERS") return counts.members;
  if (kind === "PRESENT") return counts.present ?? counts.members;
  return null;
}
