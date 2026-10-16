import type { ReactNode } from "react";
import Hemicycle from "@/components/Hemicycle";
import Icon from "@/components/Icon";

/** Pagine fuori dal portale (login, recupero e cambio codice): pannello blu istituzionale a sinistra, modulo a destra. */
export default function AuthLayout({
  headline,
  text,
  eyebrow = "Assemblea dei Rappresentanti",
  children
}: {
  headline: string;
  text: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <main className="login">
      <section className="login-aside">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div>
            <div className="brand">Comitato Studentesco</div>
            <div className="brand-sub">Piattaforma di voto e presenze</div>
          </div>
        </div>

        <div className="login-hero">
          <span className="login-pill">
            <span className="pulse-dot" aria-hidden="true" />
            {eyebrow}
          </span>
          <h1>{headline}</h1>
          <p>{text}</p>
        </div>

        <div className="login-hemi-wrap">
          <Hemicycle className="hemicycle" />
          <div className="login-aside-foot">
            <span><i className="hemi-dot full" /> Voto registrato</span>
            <span><i className="hemi-dot mid" /> Presente in aula</span>
            <span><i className="hemi-dot base" /> Seggio assegnato</span>
          </div>
        </div>
      </section>

      <section className="login-main">
        <div className="login-box">
          {children}
          <div className="login-security-badge">
            <Icon name="shield" size={16} />
            <span>Connessione protetta · Telefono cifrato e voto segreto disaccoppiato</span>
          </div>
        </div>
      </section>
    </main>
  );
}
