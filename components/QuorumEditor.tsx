"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { MajorityKind, QuorumBase } from "@/lib/quorum";

/** Modifica il quorum della votazione: percentuale e base di calcolo (presenti o membri totali). */
export default function QuorumEditor({
  pollId,
  percent,
  base,
  majority,
  canUsePresent,
  disabled
}: {
  pollId: string;
  percent: number;
  base: QuorumBase;
  majority: MajorityKind;
  canUsePresent: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(percent));
  const [kind, setKind] = useState<QuorumBase>(base);
  const [maj, setMaj] = useState<MajorityKind>(majority);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const res = await apiFetch("/api/polls/" + pollId + "/quorum", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ percent: Number(value), base: kind, majority: maj })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Quorum non salvato");
      return;
    }
    setMessage("Quorum aggiornato.");
    router.refresh();
  }

  return (
    <form className="quorum-editor" onSubmit={save}>
      <label>
        Quorum (%)
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || busy}
          required
        />
      </label>
      <label>
        Calcolato su
        <select value={kind} onChange={(e) => setKind(e.target.value as QuorumBase)} disabled={disabled || busy}>
          <option value="MEMBERS">Membri totali</option>
          <option value="PRESENT" disabled={!canUsePresent}>
            Presenti alla seduta{canUsePresent ? "" : " (serve una seduta)"}
          </option>
        </select>
      </label>
      <label>
        Maggioranza
        <select value={maj} onChange={(e) => setMaj(e.target.value as MajorityKind)} disabled={disabled || busy}>
          <option value="EXPRESSED">Semplice (voti espressi)</option>
          <option value="PRESENT" disabled={!canUsePresent}>Assoluta sui presenti</option>
          <option value="MEMBERS">Assoluta sui membri totali</option>
        </select>
      </label>
      <button disabled={disabled || busy}>{busy ? "Salvataggio..." : "Salva quorum"}</button>
      {message && <span className="muted" role="status">{message}</span>}
      {error && <span className="error-box" role="alert">{error}</span>}
    </form>
  );
}
