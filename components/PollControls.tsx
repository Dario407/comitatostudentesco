"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api";

type Pending = { title: string; message: string; label: string; run: () => Promise<Response> } | null;

/** Chiudi, riapri o azzera una votazione dalla pagina dei risultati. */
export default function PollControls({ pollId, status }: { pollId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setStatus(next: "OPEN" | "CLOSED") {
    return () =>
      apiFetch("/api/polls/" + pollId + "/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next })
      });
  }

  async function run(action: () => Promise<Response>) {
    setBusy(true);
    setError("");
    const res = await action();
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Operazione non riuscita");
      return;
    }
    router.refresh();
  }

  return (
    <div className="row">
      {status === "OPEN" ? (
        <button className="secondary" disabled={busy} onClick={() => run(setStatus("CLOSED"))}>
          Chiudi votazione
        </button>
      ) : (
        <button className="secondary" disabled={busy} onClick={() => run(setStatus("OPEN"))}>
          {status === "CLOSED" ? "Riapri votazione" : "Apri votazione"}
        </button>
      )}

      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          setPending({
            title: "Azzerare la votazione?",
            message:
              "Tutti i voti e le partecipazioni vengono cancellati e tutti potranno votare da capo. L'operazione non si può annullare.",
            label: "Azzera e fai rivotare",
            run: () => apiFetch("/api/polls/" + pollId + "/reset", { method: "POST" })
          })
        }
      >
        Azzera voti
      </button>

      {error && <span className="error">{error}</span>}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        message={pending?.message ?? ""}
        confirmLabel={pending?.label}
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending?.run;
          setPending(null);
          if (action) void run(action);
        }}
      />
    </div>
  );
}
