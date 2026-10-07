import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import Hemicycle from "@/components/Hemicycle";

export default async function LoginPage() {
  if (await sessionUser()) redirect("/dashboard");

  return (
    <main className="login">
      <section className="login-aside">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div className="brand">Comitato Studentesco</div>
        </div>

        <div>
          <h1>Ogni voce conta in aula.</h1>
          <p>
            Presenze, votazioni e archivio delle sedute del Comitato in un unico spazio
            semplice da usare.
          </p>
        </div>

        <Hemicycle className="hemicycle" />
      </section>

      <section className="login-main">
        <div className="login-box">
          <h2>Accedi</h2>
          <p className="muted">Inserisci il numero registrato e il tuo codice personale.</p>

          <LoginForm />

          <p className="meta login-note">
            Accesso riservato ai rappresentanti. Se non hai un codice, chiedilo a un
            rappresentante d'istituto.
          </p>
        </div>
      </section>
    </main>
  );
}
