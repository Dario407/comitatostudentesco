import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  if (await sessionUser()) redirect("/dashboard");

  return (
    <main className="login">
      <section className="login-shell">
        <div className="login-art">
          <h1>Comitato Studentesco</h1>
          <p>
            Presenze, votazioni e attività del Comitato in un unico spazio
            semplice da usare.
          </p>
        </div>

        <div className="login-panel">
          <div className="brand-row">
            <div className="brand-mark">CS</div>
            <div>
              <div className="brand">Comitato Studentesco</div>
              <div className="meta">Accesso riservato</div>
            </div>
          </div>

          <h2>Accedi</h2>
          <p className="muted">
            Inserisci il numero registrato e il tuo codice personale.
          </p>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
