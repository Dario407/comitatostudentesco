"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="secondary"
      onClick={async () => {
        await apiFetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      Esci
    </button>
  );
}
