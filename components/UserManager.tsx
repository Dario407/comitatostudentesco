"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  role: "CLASS_REP" | "INSTITUTE_REP" | "ADMIN";
  active: boolean;
};

function roleLabel(role: Member["role"]) {
  if (role === "INSTITUTE_REP") return "Rappresentante d'istituto";
  if (role === "ADMIN") return "Amministratore tecnico";
  return "Rappresentante di classe";
}

export default function UserManager({ users }: { users: Member[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setIssuedCode(null);

    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        className: form.get("className"),
        phone: form.get("phone"),
        role: form.get("role")
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(data.error ?? "Impossibile creare l'utente.");
      return;
    }

    setIssuedCode({
      name: `${data.user.firstName} ${data.user.lastName}`,
      code: data.accessCode
    });
    setMessage("Utente creato.");
    formEl.reset();
    router.refresh();
  }

  async function toggleActive(user: Member) {
    setMessage("");

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !user.active })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(data.error ?? "Impossibile aggiornare l'utente.");
      return;
    }

    router.refresh();
  }

  async function resetCode(user: Member) {
    setMessage("");
    setIssuedCode(null);

    const res = await fetch(`/api/users/${user.id}/reset-code`, {
      method: "POST"
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage(data.error ?? "Impossibile rigenerare il codice.");
      return;
    }

    setIssuedCode({
      name: `${user.firstName} ${user.lastName}`,
      code: data.accessCode
    });
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Nuovo rappresentante</h2>

        <form className="stack" onSubmit={createUser}>
          <div className="grid">
            <div className="field">
              <label>Nome</label>
              <input name="firstName" required />
            </div>

            <div className="field">
              <label>Cognome</label>
              <input name="lastName" required />
            </div>

            <div className="field">
              <label>Classe</label>
              <input name="className" placeholder="3BES" required />
            </div>

            <div className="field">
              <label>Numero di telefono</label>
              <input name="phone" inputMode="tel" placeholder="+39 3..." required />
            </div>

            <div className="field">
              <label>Ruolo</label>
              <select name="role" defaultValue="CLASS_REP">
                <option value="CLASS_REP">Rappresentante di classe</option>
                <option value="INSTITUTE_REP">Rappresentante d'istituto</option>
                <option value="ADMIN">Amministratore tecnico</option>
              </select>
            </div>
          </div>

          <button>Crea account</button>
        </form>
      </section>

      {issuedCode && (
        <section className="notice">
          <strong>Codice di accesso per {issuedCode.name}:</strong>
          <div className="issued-code">{issuedCode.code}</div>
          <div>
            Copialo adesso: il sistema conserva solo l'hash e non potrà mostrarlo di nuovo.
          </div>
        </section>
      )}

      {message && <div className="muted">{message}</div>}

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Utenti</h2>
          <span className="badge green">
            {users.filter((user) => user.active).length} attivi
          </span>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Classe</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.lastName} {user.firstName}</td>
                <td>{user.className}</td>
                <td>{roleLabel(user.role)}</td>
                <td>{user.active ? "Attivo" : "Disattivato"}</td>
                <td>
                  <div className="row">
                    <button className="secondary" onClick={() => resetCode(user)}>
                      Nuovo codice
                    </button>
                    <button
                      className={user.active ? "danger" : ""}
                      onClick={() => toggleActive(user)}
                    >
                      {user.active ? "Disattiva" : "Riattiva"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
