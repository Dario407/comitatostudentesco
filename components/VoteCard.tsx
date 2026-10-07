"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

type Option = {
  id: string;
  label: string;
  position: number;
};

export default function VoteCard({
  pollId,
  options,
  secret = false
}: {
  pollId: string;
  options: Option[];
  secret?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedLabel = options.find((option) => option.id === selected)?.label ?? "";

  function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected) setConfirming(true);
  }

  async function submit() {
    setConfirming(false);
    setError("");
    setBusy(true);

    const res = await apiFetch("/api/polls/" + pollId + "/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId: selected })
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Voto non registrato");
      return;
    }

    router.refresh();
  }

  return (
    <>
      <form className="stack" onSubmit={ask}>
        <div className="option-list" role="radiogroup" aria-label="Scelte disponibili">
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

        <div className="ballot-actions">
          <button disabled={busy || !selected}>
            {busy ? "Registrazione..." : "Vota"}
          </button>
          <span className="meta">Potrai confermare prima dell'invio.</span>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Conferma il tuo voto"
        message={
          "Stai per votare «" +
          selectedLabel +
          "»." +
          (secret ? " Il voto è segreto." : "") +
          " Dopo l'invio non potrai modificarlo."
        }
        confirmLabel="Conferma voto"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
