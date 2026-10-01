"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
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
      setError(data.error ?? "Accesso non riuscito");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={submit}>
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
        <input id="code" name="code" autoComplete="one-time-code" required />
      </div>

      {error && <div className="error">{error}</div>}

      <button disabled={busy}>{busy ? "Accesso..." : "Accedi"}</button>
    </form>
  );
}
