import type { ReactNode } from "react";
import Hemicycle from "@/components/Hemicycle";

/** Pagine fuori dal portale (recupero e cambio codice): pannello blu a sinistra, modulo a destra. */
export default function AuthLayout({
  headline,
  text,
  children
}: {
  headline: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <main className="login">
      <section className="login-aside">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div className="brand">Comitato Studentesco</div>
        </div>
        <div>
          <h1>{headline}</h1>
          <p>{text}</p>
        </div>
        <Hemicycle className="hemicycle" />
      </section>
      <section className="login-main">
        <div className="login-box">{children}</div>
      </section>
    </main>
  );
}
