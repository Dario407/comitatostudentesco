"use client";

import { useEffect, useState } from "react";

export default function ProjectionModeButton() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggle() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  return (
    <button type="button" className="secondary" onClick={toggle}>
      {active ? "Esci da schermo intero" : "Modalità proiezione"}
    </button>
  );
}
