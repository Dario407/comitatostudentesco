"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

export default function LoginForm({ emailEnabled = false }: { emailEnabled?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"code" | "otp">("code");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  // Stato per accesso con codice monouso via email (OTP)
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code })
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Accesso non riuscito");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function onRequestOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/email-otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: phone })
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Impossibile inviare il codice via email");
      return;
    }

    setOtpToken(data.token);
    setOtpCode("");
  }

  async function onVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!otpToken) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/email-otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: otpToken, code: otpCode })
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Codice non valido o scaduto");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (mode === "otp") {
    return (
      <div className="stack">
        {!otpToken ? (
          <form className="stack" onSubmit={onRequestOtp}>
            <div className="notice">
              <Icon name="mail" size={18} />
              <div>
                <strong>Accesso rapido con codice via email</strong>
                <div>
                  Se hai già verificato un indirizzo email nel tuo profilo, riceverai un codice monouso a 6 cifre valido per 10 minuti.
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="otp-identifier">Email verificata o Numero di telefono</label>
              <input
                id="otp-identifier"
                type="text"
                autoComplete="username"
                placeholder="nome@scuola.it oppure +39 333 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="error-box">
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            )}

            <button disabled={loading}>
              <Icon name="mail" size={16} />
              <span>{loading ? "Invio in corso..." : "Invia codice a 6 cifre"}</span>
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() => {
                setMode("code");
                setError("");
              }}
            >
              Torna all&apos;accesso con codice personale
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={onVerifyOtp}>
            <div className="success-box">
              <Icon name="check" size={18} />
              <span>
                Se l&apos;account indicato ha un&apos;email verificata, abbiamo inviato un codice a 6 cifre (valido 10 minuti).
              </span>
            </div>

            <div className="field">
              <label htmlFor="otp-code">Codice a 6 cifre ricevuto via email</label>
              <input
                id="otp-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                style={{ fontSize: "1.25rem", letterSpacing: "0.22em", textAlign: "center", fontWeight: 700 }}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="error-box">
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            )}

            <button disabled={loading || otpCode.length !== 6}>
              {loading ? "Verifica in corso..." : "Verifica ed entra"}
            </button>

            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className="secondary small"
                onClick={() => {
                  setOtpToken(null);
                  setOtpCode("");
                  setError("");
                }}
              >
                Cambia indirizzo / Rinvia
              </button>
              <button
                type="button"
                className="secondary small"
                onClick={() => {
                  setOtpToken(null);
                  setMode("code");
                  setError("");
                }}
              >
                Usa codice personale
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmitCode}>
      <div className="field">
        <label htmlFor="phone">Numero di telefono o Email</label>
        <input
          id="phone"
          type="text"
          autoComplete="username"
          placeholder="+39 333 123 4567 oppure nome@scuola.it"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <span className="hint">
          Puoi entrare con il tuo numero di cellulare oppure con l&apos;indirizzo email verificato nel profilo.
        </span>
      </div>

      <div className="field">
        <label htmlFor="code">Codice di accesso</label>
        <div className="password-field">
          <input
            id="code"
            type={showCode ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Il tuo codice personale"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowCode((v) => !v)}
            aria-label={showCode ? "Nascondi codice" : "Mostra codice"}
            title={showCode ? "Nascondi codice" : "Mostra codice"}
          >
            <Icon name={showCode ? "eye-off" : "eye"} size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      <button disabled={loading}>{loading ? "Accesso in corso..." : "Entra nel portale"}</button>

      {emailEnabled && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setMode("otp");
            setError("");
          }}
        >
          <Icon name="mail" size={16} />
          <span>Accedi con codice monouso via email (OTP)</span>
        </button>
      )}

      <p className="meta" style={{ textAlign: "center", marginTop: 2 }}>
        <Link href="/recupero">Hai dimenticato il codice di accesso?</Link>
      </p>
    </form>
  );
}
