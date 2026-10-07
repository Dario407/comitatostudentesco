import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { CODE_MAX_AGE_DAYS, codeChangeRequired } from "@/lib/codePolicy";
import ChangeCodeForm from "@/components/ChangeCodeForm";
import Hemicycle from "@/components/Hemicycle";

export default async function ChangeCodePage() {
  const user = await sessionUser();
  if (!user || !user.active) redirect("/login");

  const reason = await codeChangeRequired(user);

  return (
    <main className="login">
      <section className="login-aside">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div className="brand">Comitato Studentesco</div>
        </div>
        <div>
          <h1>Un codice solo tuo.</h1>
          <p>Il codice di accesso è personale: scegline uno nuovo e non condividerlo con nessuno.</p>
        </div>
        <Hemicycle className="hemicycle" />
      </section>

      <section className="login-main">
        <div className="login-box">
          <h2>Cambia codice</h2>
          <p className="muted">
            {reason === "first"
              ? "Il codice che hai ricevuto è provvisorio: scegline uno tuo per continuare."
              : reason === "expired"
                ? "Il codice ha più di " + CODE_MAX_AGE_DAYS + " giorni: per sicurezza va rinnovato."
                : "Scegli un nuovo codice di accesso. Le altre sessioni aperte verranno chiuse."}
          </p>

          <ChangeCodeForm />

          {!reason && (
            <p className="meta login-note">
              <Link href="/dashboard">Annulla e torna indietro</Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
