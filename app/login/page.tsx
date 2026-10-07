import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  if (await sessionUser()) redirect("/dashboard");

  return (
    <main className="login">
      <section className="login-ticket">
        <div className="login-stub">
          <div className="ballot-mark" aria-hidden="true" />
          <h1>Comitato Studentesco</h1>
          <p>
            Presenze, votazioni e attività del Comitato in un unico spazio
            semplice da usare.
          </p>
        </div>

        <div className="login-panel">
          <h2>Accedi</h2>
          <p className="muted">
            Inserisci il numero registrato e il tuo codice personale.
          </p>

          <LoginForm />

          <p className="meta login-note">
            Accesso riservato ai rappresentanti. Se non hai un codice, chiedilo
            a un rappresentante d'istituto.
          </p>
        </div>
      </section>
    </main>
  );
}
