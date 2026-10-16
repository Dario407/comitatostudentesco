"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/Icon";

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
  const [successMsg, setSuccessMsg] = useState("");

  async function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccessMsg("");
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

  async function resend() {
    if (!address || busy) return;
    setBusy(true);
    setError("");
    const res = await apiFetch("/api/account/email/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Invio non riuscito");
      return;
    }
    setToken(data.token);
    setSuccessMsg("Nuovo codice inviato a " + address);
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
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
    setSuccessMsg("Email di recupero verificata e salvata con successo.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setSuccessMsg("");
    await apiFetch("/api/account/email", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!mailEnabled) {
    return (
      <div className="notice">
        <Icon name="info" size={18} />
        <span>
          L&apos;invio delle email non è al momento configurato sul server: puoi comunque recuperare il
          codice tramite il tuo compagno di classe o un rappresentante d&apos;istituto.
        </span>
      </div>
    );
  }

  return (
    <div className="stack">
      {successMsg && !token && (
        <div className="success-box" role="status">
          <Icon name="check" size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {maskedEmail && !token && (
        <div className="email-saved-banner">
          <div className="email-saved-info">
            <span className="badge green">
              <Icon name="check" size={14} /> Verificata
            </span>
            <div>
              <div className="item-title">{maskedEmail}</div>
              <div className="meta">Attiva per il recupero autonomo del codice di accesso</div>
            </div>
          </div>
          <button type="button" className="secondary small" disabled={busy} onClick={remove}>
            Rimuovi email
          </button>
        </div>
      )}

      {token ? (
        <form className="stack otp-box" onSubmit={confirm}>
          <div className="otp-head">
            <span className="badge">Verifica in corso</span>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Abbiamo inviato un codice a 6 cifre a <strong>{address}</strong> (valido 15 minuti).
            </p>
          </div>

          <div className="field">
            <label htmlFor="code">Codice di conferma a 6 cifre</label>
            <input
              id="code"
              name="code"
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              required
            />
          </div>

          {error && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="success-box" role="status">
              <Icon name="check" size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="row">
            <button disabled={busy}>{busy ? "Verifica in corso..." : "Conferma e salva email"}</button>
            <button type="button" className="secondary" disabled={busy} onClick={resend}>
              Invia di nuovo
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy}
              onClick={() => {
                setToken(null);
                setError("");
                setSuccessMsg("");
              }}
            >
              Cambia indirizzo
            </button>
          </div>
        </form>
      ) : (
        <form className="stack" onSubmit={request}>
          <div className="field">
            <label htmlFor="email">
              {maskedEmail ? "Sostituisci email di recupero" : "Aggiungi email di recupero"}
            </label>
            <div className="input-with-button">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nome.cognome@studenti.scuola.edu.it"
                required
              />
              <button disabled={busy}>
                <Icon name="mail" size={17} />
                <span>{busy ? "Invio..." : "Invia codice"}</span>
              </button>
            </div>
            <p className="hint">
              Ti invieremo un codice di verifica a 6 cifre per confermare che l&apos;indirizzo sia tuo.
            </p>
          </div>
          {error && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
