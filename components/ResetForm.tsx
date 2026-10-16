"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/Icon";

export default function ResetForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [nextVal, setNextVal] = useState("");
  const [repeatVal, setRepeatVal] = useState("");

  const longEnough = nextVal.length >= 8;
  const matching = nextVal.length > 0 && nextVal === repeatVal;

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
        <div className="success-box">
          <Icon name="check" size={18} />
          <div>
            <strong>Codice aggiornato con successo.</strong> Ora puoi accedere al portale con il tuo nuovo codice.
          </div>
        </div>
        <Link className="button" href="/login">Vai all&apos;accesso</Link>
      </div>
    );
  }

  return (
    <form className="stack login-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="next">Nuovo codice personale</label>
        <div className="password-field">
          <input
            id="next"
            name="next"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={nextVal}
            onChange={(e) => setNextVal(e.target.value)}
            placeholder="Minimo 8 caratteri"
            required
          />
          <button
            type="button"
            className="password-toggle"
            aria-pressed={show}
            onClick={() => setShow((v) => !v)}
          >
            <Icon name={show ? "eye-off" : "eye"} size={17} />
            <span>{show ? "Nascondi" : "Mostra"}</span>
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="repeat">Ripeti il nuovo codice</label>
        <input
          id="repeat"
          name="repeat"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          value={repeatVal}
          onChange={(e) => setRepeatVal(e.target.value)}
          placeholder="Conferma il codice"
          required
        />
      </div>

      <div className="code-checks" aria-live="polite">
        <span className={"code-check" + (longEnough ? " ok" : "")}>
          <Icon name="check" size={14} /> Almeno 8 caratteri
        </span>
        <span className={"code-check" + (matching ? " ok" : "")}>
          <Icon name="check" size={14} /> I codici coincidono
        </span>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      <button disabled={busy || !longEnough || !matching}>
        {busy ? "Salvataggio..." : "Salva il nuovo codice"}
      </button>
    </form>
  );
}
