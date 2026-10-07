"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api";

export default function RemoveVoteButton({
  pollId,
  userId,
  name
}: {
  pollId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setOpen(false);
    setBusy(true);
    setError("");

    const res = await apiFetch("/api/polls/" + pollId + "/votes/" + userId, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Rimozione non riuscita");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className="danger" disabled={busy} onClick={() => setOpen(true)}>
        {busy ? "Rimozione..." : "Rimuovi voto"}
      </button>
      {error && <span className="error"> {error}</span>}
      <ConfirmDialog
        open={open}
        title="Rimuovere il voto?"
        message={name + " risulterà di nuovo tra chi non ha votato e potrà votare ancora."}
        confirmLabel="Rimuovi voto"
        danger
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
