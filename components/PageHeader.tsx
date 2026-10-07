import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";

export default function PageHeader({
  title,
  description,
  actions,
  back
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link className="back-link" href={back.href}>
            <Icon name="back" size={16} />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
