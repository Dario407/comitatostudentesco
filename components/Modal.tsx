"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Icon from "@/components/Icon";

/** Finestra per i moduli di creazione e modifica: si chiude con Esc o cliccando fuori. */
export default function Modal({
  open,
  title,
  description,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea");
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Chiudi" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}
