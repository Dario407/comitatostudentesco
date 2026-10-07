"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: form.get("phone"),
        code: form.get("code")
      })
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      if (res.status === 429 && typeof data.retryAfterSeconds === "number") {
        const minutes = Math.max(1, Math.ceil(data.retryAfterSeconds / 60));
        setError(
          "Troppi tentativi. Riprova tra " + minutes + (minutes === 1 ? " minuto." : " minuti.")
        );
        return;
      }

      setError(data.error ?? "Accesso non riuscito");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="stack login-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="phone">Numero di telefono</label>
        <input
          id="phone"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+39 3..."
          required
        />
      </div>

      <div className="field">
        <label htmlFor="code">Codice di accesso</label>
        <input
          id="code"
          name="code"
          type="password"
          autoComplete="current-password"
          placeholder="Inserisci il codice"
          required
        />
      </div>

      {error && <div className="error-box">{error}</div>}

      <button disabled={busy}>
        {busy ? "Accesso in corso..." : "Accedi"}
      </button>
    </form>
  );
}
