import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { codeChangeRequired } from "@/lib/codePolicy";
import LogoutButton from "@/components/LogoutButton";
import Navigation from "@/components/Navigation";

type ShellUser = {
  id: string;
  createdAt: Date;
  firstName: string;
  lastName: string;
  role: string;
  className: string;
};

function roleLabel(role: string) {
  return role === "INSTITUTE_REP" ? "Rappr. d'istituto" : "Rappr. di classe";
}

function initials(user: ShellUser) {
  return ((user.firstName[0] ?? "") + (user.lastName[0] ?? "")).toUpperCase();
}

/**
 * Cornice comune a tutte le pagine dopo l'accesso: menu laterale su desktop,
 * barra superiore e schede in basso su telefono.
 */
export default async function AppShell({
  user,
  projection = false,
  children
}: {
  user: ShellUser;
  projection?: boolean;
  children: ReactNode;
}) {
  // Codice provvisorio o scaduto: prima di usare il portale va cambiato.
  if (await codeChangeRequired(user)) redirect("/cambia-codice");

  const admin = user.role === "INSTITUTE_REP";

  return (
    <div className={"app has-tabs" + (projection ? " is-projection" : "")}>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div>
            <div className="brand">Comitato Studentesco</div>
            <div className="brand-sub">Portale delle Assemblee</div>
          </div>
        </Link>

        <Navigation admin={admin} variant="side" />

        <div className="sidebar-user">
          <Link href="/account" className="avatar" title="Il mio account" aria-label="Il mio account">
            {initials(user)}
          </Link>
          <div className="who">
            <div className="who-name">{user.firstName} {user.lastName}</div>
            <div className="who-role">
              {roleLabel(user.role)} · <span className="who-class">{user.className}</span>
            </div>
            <Link className="who-link" href="/account">Impostazioni account</Link>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="app-body">
        <header className="app-topbar">
          <Link href="/dashboard" className="brand-row">
            <div className="brand-mark" aria-hidden="true">CS</div>
            <div>
              <div className="brand">Comitato Studentesco</div>
              <div className="brand-sub">{user.firstName} · {user.className}</div>
            </div>
          </Link>
          <div className="topbar-actions">
            <Link
              href="/account"
              className="topbar-user-pill"
              title="Il mio account"
              aria-label="Il mio account"
            >
              <span className="avatar avatar-sm" aria-hidden="true">{initials(user)}</span>
              <span className="topbar-user-class">{user.className}</span>
            </Link>
            <LogoutButton />
          </div>
        </header>

        <main className="page">{children}</main>
      </div>

      <Navigation admin={admin} variant="tabs" />
    </div>
  );
}
