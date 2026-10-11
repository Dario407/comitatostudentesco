"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";

type Option = {
  id: string;
  label: string;
  position: number;
};

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Non tutti i dispositivi lo supportano: è solo un di più.
  }
}

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
  const [done, setDone] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const selectedLabel = options.find((option) => option.id === selected)?.label ?? "";

  function pick(id: string) {
    setSelected(id);
    setError("");
    buzz(8);
  }

  function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected && !busy) setConfirming(true);
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
      buzz(40);
      return;
    }

    // Conferma visibile prima che la scheda passi tra le votazioni già fatte.
    buzz(30);
    setDone(selectedLabel);
    timer.current = setTimeout(() => router.refresh(), 1600);
  }

  if (done !== null) {
    return (
      <div className="vote-success" role="status">
        <svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true">
          <circle cx="26" cy="26" r="24" className="vote-success-ring" />
          <path d="m15 27 8 8 15-17" className="vote-success-tick" />
        </svg>
        <strong>Voto registrato</strong>
        <span>{secret ? "Il tuo voto è segreto." : "Hai votato: " + done}</span>
      </div>
    );
  }

  return (
    <>
      <form className="stack vote-form" onSubmit={ask}>
        <fieldset className="option-list">
          <legend className="sr-only">Scegli una risposta</legend>
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
                onChange={() => pick(option.id)}
                required
              />
              <span className="option-label">{option.label}</span>
              <Icon name="check" size={22} />
            </label>
          ))}
        </fieldset>

        {error && <div className="error-box" role="alert">{error}</div>}

        <div className="ballot-actions">
          <button disabled={busy || !selected}>
            {busy
              ? "Registrazione..."
              : selected
                ? "Vota «" + selectedLabel + "»"
                : "Scegli una risposta"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Conferma il tuo voto"
        highlight={selectedLabel}
        message={
          (secret
            ? "Il voto è segreto: nessuno potrà collegarlo a te."
            : "Il voto è palese: i rappresentanti d'istituto vedranno la tua scelta.") +
          " Dopo l'invio non potrai modificarlo."
        }
        confirmLabel="Conferma voto"
        cancelLabel="Cambia scelta"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
