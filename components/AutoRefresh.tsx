"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ricarica i dati della pagina a intervalli, solo se la scheda è visibile. */
export default function AutoRefresh({ seconds = 5, enabled = true }: { seconds?: number; enabled?: boolean }) {
  const router = useRouter();

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

  return null;
}
