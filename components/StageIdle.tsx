"use client";

import { useEffect } from "react";

/** In proiezione nasconde il cursore e il pulsante di uscita dopo qualche secondo di inattività. */
export default function StageIdle({ seconds = 3 }: { seconds?: number }) {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      root.classList.remove("idle");
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.add("idle"), seconds * 1000);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
      root.classList.remove("idle");
    };
  }, [seconds]);

  return null;
}
