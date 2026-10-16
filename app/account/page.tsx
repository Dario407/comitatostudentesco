import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { getRecoveryEmail, maskEmail } from "@/lib/contact";
import { mailEnabled } from "@/lib/mail";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import EmailSettings from "@/components/EmailSettings";
import Icon from "@/components/Icon";

export default async function AccountPage() {
  const user = await sessionUser();
  if (!user || !user.active) redirect("/login");

  const email = await getRecoveryEmail(user.id);
  const initials = ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();
  const isAdmin = user.role === "INSTITUTE_REP";

  return (
    <AppShell user={user}>
      <PageHeader
        title="Il mio account"
        description="Gestisci le tue credenziali di accesso e il recapito di recupero."
      />

      <section className="panel profile-card">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div className="profile-main">
          <div className="profile-name">{user.firstName} {user.lastName}</div>
          <div className="profile-meta">
            <span className={"badge " + (isAdmin ? "green" : "")}>
              {isAdmin ? "Rappresentante d'istituto" : "Rappresentante di classe"}
            </span>
            <span className="badge gray">Classe {user.className}</span>
            {email ? (
              <span className="badge green">
                <Icon name="check" size={13} /> Email collegata
              </span>
            ) : (
              <span className="badge orange">Nessuna email di recupero</span>
            )}
          </div>
        </div>
      </section>

      <div className="split" style={{ marginTop: 28 }}>
        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">
                <Icon name="mail" size={20} /> Email di recupero
              </h2>
              <p className="section-note">
                Se dimentichi il codice di accesso, potrai reimpostarlo in autonomia ricevendo un link via email.
              </p>
            </div>
          </div>
          <div className="panel panel-pad">
            <EmailSettings maskedEmail={email ? maskEmail(email) : null} mailEnabled={mailEnabled()} />
          </div>
        </section>

        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">
                <Icon name="lock" size={20} /> Codice di accesso
              </h2>
              <p className="section-note">
                Puoi sostituire il tuo codice personale in qualsiasi momento.
              </p>
            </div>
          </div>
          <div className="panel panel-pad stack">
            <p className="muted" style={{ margin: 0 }}>
              Cambiando il codice di accesso, tutte le sessioni aperte sugli altri dispositivi vengono
              chiuse automaticamente per proteggere il tuo account.
            </p>
            <div>
              <Link className="button secondary" href="/cambia-codice">
                <Icon name="shield" size={18} /> Cambia codice personale
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
