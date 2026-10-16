import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { mailEnabled } from "@/lib/mail";
import LoginForm from "@/components/LoginForm";
import AuthLayout from "@/components/AuthLayout";

export default async function LoginPage() {
  const user = await sessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthLayout
      headline="Votazioni e presenze delle assemblee."
      text="Lo spazio riservato ai rappresentanti di classe e d'istituto per registrare le presenze, esprimere il voto e consultare i risultati ufficiali."
    >
      <h2>Accedi al portale</h2>
      <p className="muted">
        Usa il tuo numero di telefono (o l&apos;email verificata) e il tuo codice di accesso personale.
      </p>

      <LoginForm emailEnabled={mailEnabled()} />

      <p className="meta login-note">
        Il tuo numero viene convertito in un&apos;impronta crittografica irreversibile e i voti segreti sono disaccoppiati dall&apos;identità del votante.
      </p>
    </AuthLayout>
  );
}
