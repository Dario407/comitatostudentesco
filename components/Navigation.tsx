"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

type NavLink = {
  href: string;
  label: string;
  icon: IconName;
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
    { href: "/dashboard", label: "Votazioni", icon: "vote", match: (p) => p === "/dashboard" },
    ...(admin
      ? [
          {
            href: "/admin",
            label: "Gestione",
            icon: "dashboard" as const,
            match: (p: string) =>
              p === "/admin" ||
              p.startsWith("/admin/polls/") ||
              p.startsWith("/admin/meetings/")
          },
          {
            href: "/admin/users",
            label: "Utenti",
            icon: "users" as const,
            match: (p: string) => p === "/admin/users" || p.startsWith("/admin/users/")
          },
          {
            href: "/admin/registro",
            label: "Registro",
            icon: "clock" as const,
            match: (p: string) => p === "/admin/registro"
          },
          {
            href: "/archivio",
            label: "Archivio",
            icon: "archive" as const,
            match: (p: string) => p === "/archivio" || p.startsWith("/archivio/")
          }
        ]
      : [])
  ];

  // Con una sola voce la barra a schede non serve.
  if (variant === "tabs" && links.length < 2) return null;

  return (
    <nav
      className={variant === "side" ? "side-nav" : "tabs-nav"}
      aria-label={variant === "side" ? "Navigazione principale" : "Navigazione"}
    >
      {links.map((link) => {
        const active = link.match(pathname);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={(variant === "side" ? "nav-link" : "tab-link") + (active ? " active" : "")}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={link.icon} size={variant === "side" ? 20 : 22} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
