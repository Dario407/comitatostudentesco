"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ResetForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const next = String(form.get("next") ?? "");
    if (next !== String(form.get("repeat") ?? "")) {
      setError("I due codici non coincidono.");
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/auth/reset-with-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, next })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Operazione non riuscita");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="stack">
        <div className="success-box">Codice cambiato. Ora puoi accedere con quello nuovo.</div>
        <Link className="button" href="/login">Vai all'accesso</Link>
      </div>
    );
  }

  return (
    <form className="stack login-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="next">Nuovo codice</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
        <p className="hint">Almeno 8 caratteri.</p>
      </div>
      <div className="field">
        <label htmlFor="repeat">Ripeti il nuovo codice</label>
        <input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button disabled={busy}>{busy ? "Salvataggio..." : "Salva il nuovo codice"}</button>
    </form>
  );
}
