"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { apiFetch } from "@/lib/api";

type Item = { userId: string; name: string; className: string };

/** Richieste di nuovo codice a cui il compagno di classe (o un rappresentante d'istituto) può rispondere. */
export default function ResetRequestsPanel({ items }: { items: Item[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Item | null>(null);
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
    setCopied(false);
    setIssued({ name: data.name, code: data.accessCode });
    router.refresh();
  }

  async function copyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silenzioso
    }
  }

  if (items.length === 0 && !issued) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          <Icon name="shield" size={20} /> Richieste di nuovo codice{" "}
          {items.length > 0 && <span className="badge orange">{items.length}</span>}
        </h2>
      </div>

      {error && (
        <div className="flash error-box">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="panel item-list">
        {items.map((item) => (
          <div className="item" key={item.userId}>
            <div className="item-main">
              <div className="item-title">{item.name}</div>
              <div className="item-sub">
                Classe <strong>{item.className}</strong> · Ha richiesto il ripristino del codice di accesso
              </div>
            </div>
            <div className="item-actions">
              <button onClick={() => setConfirming(item)}>
                <Icon name="check" size={17} /> Approva e genera codice
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="item">
            <span className="muted">Nessuna richiesta aperta.</span>
          </div>
        )}
        <div className="list-foot">
          Approva solo se la persona te lo ha chiesto davvero: il codice provvisorio va comunicato direttamente all&apos;interessato.
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Generare un nuovo codice?"
        message={
          confirming
            ? confirming.name + " (" + confirming.className + ") ha chiesto un nuovo codice. Quello vecchio smetterà di funzionare subito."
            : ""
        }
        confirmLabel="Genera codice provvisorio"
        onConfirm={() => confirming && approve(confirming)}
        onCancel={() => setConfirming(null)}
      />

      <Modal
        open={issued !== null}
        title="Codice provvisorio generato"
        description={
          issued
            ? "Consegnalo a " + issued.name + ": al primo accesso dovrà scegliere un codice personale."
            : ""
        }
        onClose={() => setIssued(null)}
      >
        {issued && (
          <div className="stack">
            <div className="issued-code-box">
              <div className="issued-code">{issued.code}</div>
              <button
                type="button"
                className="secondary small"
                onClick={() => copyCode(issued.code)}
              >
                <Icon name={copied ? "check" : "copy"} size={16} />
                <span>{copied ? "Copiato!" : "Copia codice"}</span>
              </button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Per sicurezza questo codice viene mostrato una sola volta. Copialo prima di chiudere.
            </p>
            <div className="row modal-actions">
              <button onClick={() => setIssued(null)}>Ho consegnato il codice</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
