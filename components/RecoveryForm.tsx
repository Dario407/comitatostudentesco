"use client";

import { FormEvent, useState } from "react";
import Icon from "@/components/Icon";

type Method = "email" | "partner";

export default function RecoveryForm({ mailEnabled }: { mailEnabled: boolean }) {
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<Method>(mailEnabled ? "email" : "partner");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, method })
    });
    setBusy(false);
    if (!res.ok) {
      setError("Controlla il dato inserito e riprova.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="stack">
        <div className="success-box">
          <Icon name="check" size={18} />
          <div>
            {method === "email"
              ? "Se l'account è registrato e ha un'email di recupero verificata, ti abbiamo inviato un link valido 30 minuti per scegliere un nuovo codice."
              : "Richiesta registrata. L'altro rappresentante della tua classe (o un rappresentante d'istituto) la vedrà nella propria bacheca e potrà generarti un codice provvisorio."}
          </div>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setDone(false);
            setPhone("");
          }}
        >
          Invia un&apos;altra richiesta
        </button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="r-phone">Numero di telefono o Email verificata</label>
        <input
          id="r-phone"
          type="text"
          autoComplete="username"
          placeholder="+39 333 123 4567 oppure nome@scuola.it"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <span className="hint">
          Puoi inserire il tuo numero di cellulare oppure l&apos;indirizzo email di recupero associato al tuo account.
        </span>
      </div>

      <div className="field">
        <label>Come vuoi recuperare l&apos;accesso?</label>
        <div className="options">
          <label className={"option-card " + (method === "email" ? "selected " : "") + (!mailEnabled ? "disabled" : "")}>
            <input
              type="radio"
              name="method"
              checked={method === "email"}
              disabled={!mailEnabled}
              onChange={() => setMethod("email")}
            />
            <span className="radio" />
            <span>
              <strong style={{ display: "block", fontSize: 14 }}>Mandami un link via email</strong>
              <span className="meta">
                {mailEnabled
                  ? "Funziona se avevi già verificato un'email nella pagina Il mio account."
                  : "L'invio di email non è attivo su questo server."}
              </span>
            </span>
          </label>

          <label className={"option-card " + (method === "partner" ? "selected" : "")}>
            <input
              type="radio"
              name="method"
              checked={method === "partner"}
              onChange={() => setMethod("partner")}
            />
            <span className="radio" />
            <span>
              <strong style={{ display: "block", fontSize: 14 }}>Chiedi all&apos;altro rappresentante della mia classe</strong>
              <span className="meta">
                Vedrà la richiesta nella sua bacheca e potrà generarti un codice provvisorio (visibile anche ai rappresentanti d&apos;istituto).
              </span>
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      <button disabled={busy}>{busy ? "Invio in corso..." : "Invia richiesta"}</button>
    </form>
  );
}
