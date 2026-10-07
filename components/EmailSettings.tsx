"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function EmailSettings({
  maskedEmail,
  mailEnabled
}: {
  maskedEmail: string | null;
  mailEnabled: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const res = await apiFetch("/api/account/email/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Invio non riuscito");
      return;
    }
    setAddress(email);
    setToken(data.token);
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    const res = await apiFetch("/api/account/email/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, code })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Conferma non riuscita");
      return;
    }
    setToken(null);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await apiFetch("/api/account/email", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!mailEnabled) {
    return <div className="notice">L'invio delle email non è ancora attivo: chiedi a un rappresentante d'istituto.</div>;
  }

  return (
    <div className="stack">
      {maskedEmail && !token && (
        <div className="row">
          <span className="badge green">Email salvata: {maskedEmail}</span>
          <button className="secondary" disabled={busy} onClick={remove}>Rimuovi</button>
        </div>
      )}

      {token ? (
        <form className="stack" onSubmit={confirm}>
          <p className="muted">Ti abbiamo scritto a <strong>{address}</strong>. Inserisci il codice a 6 cifre (vale 15 minuti).</p>
          <div className="field">
            <label htmlFor="code">Codice di conferma</label>
            <input id="code" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required />
          </div>
          {error && <div className="error-box">{error}</div>}
          <div className="row">
            <button disabled={busy}>{busy ? "Verifica..." : "Conferma email"}</button>
            <button type="button" className="secondary" onClick={() => setToken(null)}>Indietro</button>
          </div>
        </form>
      ) : (
        <form className="stack" onSubmit={request}>
          <div className="field">
            <label htmlFor="email">{maskedEmail ? "Cambia email di recupero" : "Email di recupero"}</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="nome@esempio.it" required />
            <p className="hint">Serve per scegliere un nuovo codice se lo dimentichi. Ti mandiamo un codice per confermarla.</p>
          </div>
          {error && <div className="error-box">{error}</div>}
          <div><button disabled={busy}>{busy ? "Invio..." : "Invia codice di conferma"}</button></div>
        </form>
      )}
    </div>
  );
}
