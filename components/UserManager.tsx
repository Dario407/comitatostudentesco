"use client";

import { FormEvent, useMemo, useState } from "react";
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

function roleBadge(role: Member["role"]) {
  if (role === "INSTITUTE_REP") return "green";
  if (role === "ADMIN") return "orange";
  return "gray";
}

export default function UserManager({ users }: { users: Member[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((user) => {
      const text =
        user.firstName +
        " " +
        user.lastName +
        " " +
        user.className +
        " " +
        roleLabel(user.role);

      const matchesQuery = !normalized || text.toLowerCase().includes(normalized);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.active) ||
        (statusFilter === "INACTIVE" && !user.active);

      return matchesQuery && matchesStatus;
    });
  }, [users, query, statusFilter]);

  function notify(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

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
      notify(data.error ?? "Impossibile creare l'utente.", "error");
      return;
    }

    setIssuedCode({
      name: data.user.firstName + " " + data.user.lastName,
      code: data.accessCode
    });
    notify("Utente creato correttamente.");
    formEl.reset();
    router.refresh();
  }

  async function toggleActive(user: Member) {
    setMessage("");

    const res = await fetch("/api/users/" + user.id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !user.active })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      notify(data.error ?? "Impossibile aggiornare l'utente.", "error");
      return;
    }

    notify(user.active ? "Utente disattivato." : "Utente riattivato.");
    router.refresh();
  }

  async function resetCode(user: Member) {
    setMessage("");
    setIssuedCode(null);

    const res = await fetch("/api/users/" + user.id + "/reset-code", {
      method: "POST"
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      notify(data.error ?? "Impossibile rigenerare il codice.", "error");
      return;
    }

    setIssuedCode({
      name: user.firstName + " " + user.lastName,
      code: data.accessCode
    });
    notify("Nuovo codice generato.");
  }

  return (
    <div className="stack">
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Nuovo account</h2>
            <div className="section-subtitle">
              Aggiungi un rappresentante e genera automaticamente il suo codice.
            </div>
          </div>
        </div>

        <section className="card">
          <form className="stack" onSubmit={createUser}>
            <div className="grid">
              <div className="field">
                <label>Nome</label>
                <input name="firstName" placeholder="Nome" required />
              </div>

              <div className="field">
                <label>Cognome</label>
                <input name="lastName" placeholder="Cognome" required />
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

            <div className="row">
              <button>Crea account</button>
              <span className="meta">
                Il codice verrà mostrato una sola volta.
              </span>
            </div>
          </form>
        </section>
      </section>

      {issuedCode && (
        <section className="success-box">
          <strong>Codice di accesso per {issuedCode.name}</strong>
          <div className="issued-code">{issuedCode.code}</div>
          <div>
            Copialo ora e consegnalo all'utente. Nel database viene conservato
            solo l'hash.
          </div>
        </section>
      )}

      {message && !issuedCode && (
        <div className={messageType === "success" ? "success-box" : "error-box"}>
          {message}
        </div>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Utenti</h2>
            <div className="section-subtitle">
              Cerca, rigenera i codici o modifica lo stato degli account.
            </div>
          </div>
          <span className="badge green">
            {users.filter((user) => user.active).length} attivi
          </span>
        </div>

        <div className="card stack">
          <div className="search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, classe o ruolo..."
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
              }
            >
              <option value="ALL">Tutti</option>
              <option value="ACTIVE">Attivi</option>
              <option value="INACTIVE">Disattivati</option>
            </select>
          </div>

          <div className="meta">
            {filteredUsers.length} risultati
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Utente</th>
                  <th>Classe</th>
                  <th>Ruolo</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="user-name">
                        {user.lastName} {user.firstName}
                      </span>
                    </td>
                    <td>{user.className}</td>
                    <td>
                      <span className={"badge " + roleBadge(user.role)}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      <span className={"badge " + (user.active ? "green" : "red")}>
                        {user.active ? "Attivo" : "Disattivato"}
                      </span>
                    </td>
                    <td>
                      <div className="row">
                        <button
                          className="secondary"
                          onClick={() => resetCode(user)}
                        >
                          Nuovo codice
                        </button>
                        <button
                          className={user.active ? "danger" : "ghost"}
                          onClick={() => toggleActive(user)}
                        >
                          {user.active ? "Disattiva" : "Riattiva"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="muted">Nessun utente corrisponde ai filtri.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
