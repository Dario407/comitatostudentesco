import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { getRecoveryEmail, maskEmail } from "@/lib/contact";
import { mailEnabled } from "@/lib/mail";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import EmailSettings from "@/components/EmailSettings";

export default async function AccountPage() {
  const user = await sessionUser();
  if (!user || !user.active) redirect("/login");

  const email = await getRecoveryEmail(user.id);

  return (
    <AppShell user={user}>
      <PageHeader title="Il mio account" description={user.firstName + " " + user.lastName + " · " + user.className} />

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Email di recupero</h2>
            <p className="section-note">Se dimentichi il codice, ti scrive un link per sceglierne uno nuovo. Salvala adesso, prima di averne bisogno.</p>
          </div>
        </div>
        <div className="panel panel-pad">
          <EmailSettings maskedEmail={email ? maskEmail(email) : null} mailEnabled={mailEnabled()} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Codice di accesso</h2>
            <p className="section-note">Cambialo quando vuoi: le altre sessioni aperte si chiudono.</p>
          </div>
          <Link className="button secondary" href="/cambia-codice">Cambia codice</Link>
        </div>
      </section>
    </AppShell>
  );
}
