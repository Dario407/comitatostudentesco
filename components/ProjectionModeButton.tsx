"use client";

import { useCallback, useEffect, useState } from "react";

const CLASS_NAME = "projecting";

/**
 * Entra a schermo intero e applica il layout "proiezione", che sta tutto in una
 * schermata senza scorrere. Il layout è legato a una classe, non solo allo schermo intero:
 * se il browser rifiuta il fullscreen la pagina riempie comunque la finestra.
 */
export default function ProjectionModeButton() {
  const [active, setActive] = useState(false);

  const stop = useCallback(async () => {
    document.documentElement.classList.remove(CLASS_NAME);
    setActive(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  const start = useCallback(async () => {
    document.documentElement.classList.add(CLASS_NAME);
    setActive(true);
    window.scrollTo(0, 0);
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Fullscreen negato: resta il layout a tutta finestra, Esc o il pulsante per uscire.
    }
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      // Uscita dal fullscreen con Esc: chiude anche il layout di proiezione.
      if (!document.fullscreenElement) {
        document.documentElement.classList.remove(CLASS_NAME);
        setActive(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.documentElement.classList.contains(CLASS_NAME)) {
        void stop();
      }
    };

    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove(CLASS_NAME);
    };
  }, [stop]);

  return (
    <button type="button" onClick={active ? stop : start}>
      {active ? "Esci dalla proiezione" : "Modalità proiezione"}
    </button>
  );
}
