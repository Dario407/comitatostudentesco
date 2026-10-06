"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Votazioni" },
    ...(admin ? [
      { href: "/admin", label: "Amministrazione" },
      { href: "/admin/users", label: "Utenti" }
    ] : [])
  ];

  return (
    <nav className="main-nav" aria-label="Navigazione principale">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));

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
    </nav>
  );
}
