"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const optionId = String(form.get("optionId") ?? "");

    const res = await apiFetch("/api/polls/" + pollId + "/vote", {
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
    const done = disabledReason === "Voto già registrato.";

    return (
      <div className={done ? "success-box" : "notice"}>
        {disabledReason}
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="option-list">
        {options.map((option) => (
          <label
            className={"option " + (selected === option.id ? "selected" : "")}
            key={option.id}
          >
            <input
              type="radio"
              name="optionId"
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
              required
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      <button disabled={busy || !selected}>
        {busy ? "Registrazione..." : "Conferma voto"}
      </button>
    </form>
  );
}
