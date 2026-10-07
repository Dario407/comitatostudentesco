"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function RecoveryForm({ mailEnabled }: { mailEnabled: boolean }) {
  const [method, setMethod] = useState<"email" | "partner">(mailEnabled ? "email" : "partner");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await apiFetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: form.get("phone"), method })
    });
    setBusy(false);
    if (!res.ok) {
      setError("Controlla il numero e riprova.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="success-box">
        {method === "email" ? (
          <>
            <strong>Controlla la posta.</strong> Se il numero è registrato e ha un'email di recupero,
            ti abbiamo scritto un link valido 30 minuti. Guarda anche tra la posta indesiderata.
          </>
        ) : (
          <>
            <strong>Richiesta inviata.</strong> Il tuo compagno di classe (o un rappresentante
            d'istituto) la vede appena entra nel portale. Quando la approva ti consegna un codice
            provvisorio, che dovrai cambiare al primo accesso. La richiesta vale 24 ore.
          </>
        )}
      </div>
    );
  }

  return (
    <form className="stack login-form" onSubmit={submit}>
      <div className="segmented" role="group" aria-label="Come vuoi recuperarlo">
        {mailEnabled && (
          <button type="button" className={method === "email" ? "active" : ""} onClick={() => setMethod("email")}>
            Con la mia email
          </button>
        )}
        <button type="button" className={method === "partner" ? "active" : ""} onClick={() => setMethod("partner")}>
          Con il compagno di classe
        </button>
      </div>

      <p className="muted">
        {method === "email"
          ? "Ti mandiamo un link all'email di recupero che hai salvato nel tuo account."
          : "Chiedi al tuo compagno di classe: dal suo portale potrà generarti un codice provvisorio."}
      </p>

      <div className="field">
        <label htmlFor="phone">Numero di telefono</label>
        <input id="phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="+39 3..." required />
      </div>

      {error && <div className="error-box">{error}</div>}

      <button disabled={busy}>{busy ? "Invio..." : method === "email" ? "Invia il link" : "Invia la richiesta"}</button>
    </form>
  );
}
