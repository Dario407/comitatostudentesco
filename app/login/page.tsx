import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  if (await sessionUser()) redirect("/dashboard");

  return (
    <main className="login">
      <section className="card">
        <div className="brand">Comitato Studentesco</div>
        <h1>Accedi</h1>
        <p className="muted">
          Usa il numero registrato e il codice fornito dai rappresentanti d'istituto.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
