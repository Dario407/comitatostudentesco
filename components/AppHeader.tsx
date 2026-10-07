import type { ReactNode } from "react";
import Navigation from "@/components/Navigation";

export default function AppHeader({
  admin = false,
  projection = false,
  children
}: {
  admin?: boolean;
  projection?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={"masthead" + (projection ? " projection-masthead" : "")}>
      <div className="masthead-inner">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">CS</div>
          <div>
            <div className="brand">Comitato Studentesco</div>
            <div className="brand-sub">Portale del Comitato</div>
          </div>
        </div>

        <div className="masthead-actions">
          {children}
          <Navigation admin={admin} />
        </div>
      </div>
    </header>
  );
}
