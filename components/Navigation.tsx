"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

type NavLink = {
  href: string;
  label: string;
  // Percorsi che appartengono alla stessa sezione e tengono acceso il link.
  match: (pathname: string) => boolean;
};

export default function Navigation({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: "/dashboard", label: "Votazioni", match: (p) => p === "/dashboard" },
    ...(admin
      ? [
          {
            href: "/admin",
            label: "Amministrazione",
            match: (p: string) =>
              p === "/admin" ||
              p.startsWith("/admin/polls/") ||
              p.startsWith("/admin/meetings/")
          },
          {
            href: "/admin/users",
            label: "Utenti",
            match: (p: string) => p === "/admin/users" || p.startsWith("/admin/users/")
          },
          {
            href: "/archivio",
            label: "Archivio",
            match: (p: string) => p === "/archivio" || p.startsWith("/archivio/")
          }
        ]
      : [])
  ];

  return (
    <nav className="main-nav" aria-label="Navigazione principale">
      {links.map((link) => {
        const active = link.match(pathname);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={"nav-link" + (active ? " active" : "")}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      <span className="nav-spacer" />
      <LogoutButton />
    </nav>
  );
}
