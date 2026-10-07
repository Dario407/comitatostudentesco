/**
 * Regole di validità di una votazione.
 *  - Quorum: votano almeno la metà più uno degli aventi diritto.
 *  - Esito: maggioranza semplice tra "sì" e "no", gli altri (astenuti, ecc.) non contano.
 * Il verdetto approvata/respinta c'è solo se le opzioni sono riconoscibili come favorevole/contrario;
 * altrimenti si indica l'opzione in testa.
 */

const YES = /^(s[iì]|favorevol[ei]|d['’]?accordo|approv\w*)$/i;
const NO = /^(no|contrari[oe]|respin\w*)$/i;

export type QuorumResult = {
  required: number;
  reached: boolean;
  verdict: "APPROVED" | "REJECTED" | "TIE" | "LEADING" | "NONE";
  leading: string | null;
};

export function quorumRequired(eligible: number) {
  return eligible === 0 ? 0 : Math.floor(eligible / 2) + 1;
}

export function evaluatePoll(
  eligible: number,
  voted: number,
  counts: { label: string; count: number }[]
): QuorumResult {
  const required = quorumRequired(eligible);
  const reached = eligible > 0 && voted >= required;

  const yes = counts.find((item) => YES.test(item.label.trim()));
  const no = counts.find((item) => NO.test(item.label.trim()));

  if (yes && no && counts.length >= 2) {
    if (yes.count === 0 && no.count === 0) return { required, reached, verdict: "NONE", leading: null };
    if (yes.count === no.count) return { required, reached, verdict: "TIE", leading: null };
    return {
      required,
      reached,
      verdict: yes.count > no.count ? "APPROVED" : "REJECTED",
      leading: yes.count > no.count ? yes.label : no.label
    };
  }

  const top = Math.max(0, ...counts.map((item) => item.count));
  if (top === 0) return { required, reached, verdict: "NONE", leading: null };
  const leaders = counts.filter((item) => item.count === top);
  return leaders.length > 1
    ? { required, reached, verdict: "TIE", leading: null }
    : { required, reached, verdict: "LEADING", leading: leaders[0].label };
}

/** Frase per schermo e verbale. `closed` distingue l'esito finale dalla situazione del momento. */
export function describeOutcome(result: QuorumResult, closed: boolean) {
  if (!result.reached) return closed ? "Quorum non raggiunto: votazione non valida" : "Quorum non ancora raggiunto";
  switch (result.verdict) {
    case "APPROVED":
      return closed ? "Approvata" : "Al momento approvata";
    case "REJECTED":
      return closed ? "Respinta" : "Al momento respinta";
    case "TIE":
      return "Parità";
    case "LEADING":
      return (closed ? "Prevale " : "In testa: ") + result.leading;
    default:
      return "Nessun voto espresso";
  }
}
