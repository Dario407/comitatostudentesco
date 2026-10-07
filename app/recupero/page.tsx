import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { mailEnabled } from "@/lib/mail";
import AuthLayout from "@/components/AuthLayout";
import RecoveryForm from "@/components/RecoveryForm";

export default async function RecoveryPage() {
  if (await sessionUser()) redirect("/dashboard");

  return (
    <AuthLayout
      headline="Hai dimenticato il codice?"
      text="Nessun problema: scegli come recuperarlo, senza dover scrivere ogni volta ai rappresentanti d'istituto."
    >
      <h2>Recupera l'accesso</h2>
      <p className="muted">Inserisci il numero con cui sei registrato.</p>
      <RecoveryForm mailEnabled={mailEnabled()} />
      <p className="meta login-note"><Link href="/login">Torna all'accesso</Link></p>
    </AuthLayout>
  );
}
