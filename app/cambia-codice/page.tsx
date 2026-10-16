import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { CODE_MAX_AGE_DAYS, codeChangeRequired } from "@/lib/codePolicy";
import ChangeCodeForm from "@/components/ChangeCodeForm";
import AuthLayout from "@/components/AuthLayout";

export default async function ChangeCodePage() {
  const user = await sessionUser();
  if (!user || !user.active) redirect("/login");

  const reason = await codeChangeRequired(user);

  return (
    <AuthLayout
      eyebrow="Sicurezza dell'account"
      headline="Un codice solo tuo."
      text="Il codice di accesso è personale e garantisce l'integrità delle votazioni: scegline uno che ricordi solo tu e non condividerlo."
    >
      <div className="login-card-head">
        <span className="eyebrow">{user.firstName} {user.lastName} · {user.className}</span>
        <h2>Cambia codice</h2>
        <p className="muted">
          {reason === "first"
            ? "Il codice che hai ricevuto è provvisorio: scegline uno personale per entrare nel portale."
            : reason === "expired"
              ? "Il codice ha più di " + CODE_MAX_AGE_DAYS + " giorni: per sicurezza va rinnovato."
              : "Scegli un nuovo codice di accesso. Le altre sessioni aperte verranno chiuse."}
        </p>
      </div>

      {reason && (
        <div className="notice" style={{ marginBottom: 18 }}>
          <strong>Cambio richiesto.</strong> Dopo aver salvato il nuovo codice sarai indirizzato subito alle votazioni.
        </div>
      )}

      <ChangeCodeForm />

      {!reason && (
        <div className="login-links">
          <Link href="/account" className="login-forgot-link">
            ← Annulla e torna all&apos;account
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
