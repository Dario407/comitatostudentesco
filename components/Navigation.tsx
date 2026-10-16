"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  group?: "main" | "admin" | "account";
  // Percorsi che appartengono alla stessa sezione e tengono acceso il link.
  match: (pathname: string) => boolean;
};

export default function Navigation({
  admin = false,
  variant
}: {
  admin?: boolean;
  variant: "side" | "tabs";
}) {
  const pathname = usePathname();

  const links: NavLink[] = [
    {
      href: "/dashboard",
      label: "Votazioni",
      icon: "vote",
      group: "main",
      match: (p) => p === "/dashboard"
    },
    ...(admin
      ? [
          {
            href: "/admin",
            label: "Gestione",
            icon: "dashboard" as const,
            group: "admin" as const,
            match: (p: string) =>
              p === "/admin" ||
              p.startsWith("/admin/polls/") ||
              p.startsWith("/admin/meetings/")
          },
          {
            href: "/admin/users",
            label: "Utenti",
            icon: "users" as const,
            group: "admin" as const,
            match: (p: string) => p === "/admin/users" || p.startsWith("/admin/users/")
          },
          {
            href: "/admin/registro",
            label: "Registro",
            icon: "clock" as const,
            group: "admin" as const,
            match: (p: string) => p === "/admin/registro"
          }
        ]
      : []),
    {
      href: "/archivio",
      label: "Archivio",
      icon: "archive",
      group: "main",
      match: (p) => p === "/archivio" || p.startsWith("/archivio/")
    },
    {
      href: "/account",
      label: "Account",
      icon: "user",
      group: "account",
      match: (p) => p === "/account" || p === "/cambia-codice"
    }
  ];

  // Su mobile, se admin ha già 5 voci principali, l'account è raggiungibile dalla barra in alto;
  // per i rappresentanti di classe mostriamo Votazioni, Archivio e Account nella barra inferiore.
  const tabLinks = admin ? links.filter((l) => l.group !== "account") : links;

  if (variant === "tabs") {
    return (
      <nav className="tabs-nav" aria-label="Navigazione">
        {tabLinks.map((link) => {
          const active = link.match(pathname);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={"tab-link" + (active ? " active" : "")}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={link.icon} size={21} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="side-nav" aria-label="Navigazione principale">
      <div className="side-nav-group">
        <span className="side-nav-label">Spazio di voto</span>
        {links
          .filter((l) => l.group === "main")
          .map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={"nav-link" + (active ? " active" : "")}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={link.icon} size={20} />
                <span>{link.label}</span>
              </Link>
            );
          })}
      </div>

      {admin && (
        <div className="side-nav-group">
          <span className="side-nav-label">Presidenza e gestione</span>
          {links
            .filter((l) => l.group === "admin")
            .map((link) => {
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={"nav-link" + (active ? " active" : "")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon name={link.icon} size={20} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </div>
      )}

      <div className="side-nav-group">
        <span className="side-nav-label">Personale</span>
        {links
          .filter((l) => l.group === "account")
          .map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={"nav-link" + (active ? " active" : "")}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={link.icon} size={20} />
                <span>{link.label}</span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
