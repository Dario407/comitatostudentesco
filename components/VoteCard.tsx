"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Option = {
  id: string;
  label: string;
  position: number;
};

export default function VoteCard({
  pollId,
  options,
  disabledReason
}: {
  pollId: string;
  options: Option[];
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const optionId = String(form.get("optionId") ?? "");

    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId })
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Voto non registrato");
      return;
    }

    router.refresh();
  }

  if (disabledReason) {
    return <div className="notice">{disabledReason}</div>;
  }

  return (
    <form className="stack" onSubmit={submit}>
      {options.map((option) => (
        <label className="option" key={option.id}>
          <input type="radio" name="optionId" value={option.id} required />
          <span>{option.label}</span>
        </label>
      ))}

      {error && <div className="error">{error}</div>}

      <button disabled={busy}>{busy ? "Registrazione..." : "Vota"}</button>
    </form>
  );
}
