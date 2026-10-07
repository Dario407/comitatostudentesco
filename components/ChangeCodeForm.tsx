"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function ChangeCodeForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const next = String(form.get("next") ?? "");

    if (next !== String(form.get("repeat") ?? "")) {
      setError("I due codici nuovi non coincidono.");
      return;
    }

    setBusy(true);
    const res = await apiFetch("/api/auth/change-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: form.get("current"), next })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Cambio non riuscito");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="stack login-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="current">Codice attuale</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">Nuovo codice</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
        <p className="hint">Almeno 8 caratteri. Scegline uno che ricordi solo tu.</p>
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
