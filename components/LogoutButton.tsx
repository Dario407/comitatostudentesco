"use client";

import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { apiFetch } from "@/lib/api";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="icon-button logout-button"
      aria-label="Esci"
      title="Esci"
      onClick={async () => {
        await apiFetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      <Icon name="logout" size={19} />
    </button>
  );
}
