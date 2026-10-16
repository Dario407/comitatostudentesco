"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

/** Ricarica i dati della pagina a intervalli, solo se la scheda è visibile. */
export default function AutoRefresh({
  seconds = 5,
  enabled = true,
  showButton = false
}: {
  seconds?: number;
  enabled?: boolean;
  showButton?: boolean;
}) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds, enabled]);

  if (!showButton) return null;

  return (
    <button
      type="button"
      className="secondary small live-refresh-btn"
      onClick={() => {
        setSpinning(true);
        router.refresh();
        setTimeout(() => setSpinning(false), 600);
      }}
      title="Aggiorna stato votazioni"
    >
      {enabled && <span className="pulse-dot green" aria-hidden="true" />}
      <span className={spinning ? "spin-once" : ""} style={{ display: "inline-flex" }}>
        <Icon name="refresh" size={15} />
      </span>
      <span>Aggiorna</span>
    </button>
  );
}
