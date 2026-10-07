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
  return role === "INSTITUTE_REP" ? "Rappresentante d'istituto" : "Rappresentante di classe";
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
    <div className={"app" + (admin ? " has-tabs" : "") + (projection ? " is-projection" : "")}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div>
            <div className="brand">Comitato Studentesco</div>
            <div className="brand-sub">Portale del Comitato</div>
          </div>
        </div>

        <Navigation admin={admin} variant="side" />

        <div className="sidebar-user">
          <div className="avatar" aria-hidden="true">{initials(user)}</div>
          <div className="who">
            <div className="who-name">{user.firstName} {user.lastName}</div>
            <div className="who-role">{roleLabel(user.role)}</div>
            <Link className="who-link" href="/cambia-codice">Cambia codice</Link>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="app-body">
        <header className="app-topbar">
          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">CS</div>
            <div className="brand">Comitato Studentesco</div>
          </div>
          <LogoutButton />
        </header>

        <main className="page">{children}</main>
      </div>

      <Navigation admin={admin} variant="tabs" />
    </div>
  );
}
