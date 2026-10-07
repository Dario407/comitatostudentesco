"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import { apiFetch } from "@/lib/api";

type Item = { userId: string; name: string; className: string };

/** Richieste di nuovo codice a cui il compagno di classe (o un rappresentante d'istituto) può rispondere. */
export default function ResetRequestsPanel({ items }: { items: Item[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Item | null>(null);
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const [error, setError] = useState("");

  async function approve(item: Item) {
    setConfirming(null);
    setError("");
    const res = await apiFetch("/api/users/" + item.userId + "/approve-reset", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Operazione non riuscita");
      router.refresh();
      return;
    }
    setIssued({ name: data.name, code: data.accessCode });
    router.refresh();
  }

  if (items.length === 0 && !issued) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Richieste di nuovo codice</h2>
      </div>

      {error && <div className="flash error-box">{error}</div>}

      <div className="panel item-list">
        {items.map((item) => (
          <div className="item" key={item.userId}>
            <div className="item-main">
              <div className="item-title">{item.name}</div>
              <div className="item-sub">{item.className} · ha dimenticato il codice di accesso</div>
            </div>
            <div className="item-actions">
              <button onClick={() => setConfirming(item)}>Genera codice</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="item"><span className="muted">Nessuna richiesta aperta.</span></div>}
        <div className="list-foot">Approva solo se la persona te lo ha chiesto davvero: il codice va consegnato di persona.</div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Generare un nuovo codice?"
        message={confirming ? confirming.name + " ha chiesto un nuovo codice. Quello vecchio smette di funzionare subito." : ""}
        confirmLabel="Genera codice"
        onConfirm={() => confirming && approve(confirming)}
        onCancel={() => setConfirming(null)}
      />

      <Modal open={issued !== null} title="Codice provvisorio" description={issued ? "Consegnalo a " + issued.name + ": al primo accesso dovrà scegliere un codice suo." : ""} onClose={() => setIssued(null)}>
        {issued && (
          <div className="stack">
            <div className="issued-code">{issued.code}</div>
            <p className="muted">Si vede una sola volta: copialo ora.</p>
            <div><button onClick={() => setIssued(null)}>Fatto</button></div>
          </div>
        )}
      </Modal>
    </section>
  );
}
