"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  role: "CLASS_REP" | "INSTITUTE_REP";
  active: boolean;
};

function roleLabel(role: Member["role"]) {
  if (role === "INSTITUTE_REP") return "Rappresentante d'istituto";
  return "Rappresentante di classe";
}

function roleBadge(role: Member["role"]) {
  if (role === "INSTITUTE_REP") return "green";
  return "gray";
}

export default function UserManager({
  users,
  currentUserId
}: {
  users: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Member | null>(null);

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

  async function saveUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;

    setBusyId(editing.id);
    setMessage("");

    const form = new FormData(e.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();

    const body: Record<string, unknown> = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      className: form.get("className")
    };

    const role = form.get("role");
    if (role) body.role = role;
    if (phone) body.phone = phone;

    const res = await fetch("/api/users/" + editing.id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      notify(data.error ?? "Impossibile modificare l'utente.", "error");
      return;
    }

    notify("Account modificato.");
    setEditing(null);
    router.refresh();
  }

  async function toggleActive(user: Member) {
    setBusyId(user.id);
    setMessage("");

    const res = await fetch("/api/users/" + user.id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !user.active })
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      notify(data.error ?? "Impossibile aggiornare l'utente.", "error");
      return;
    }

    notify(user.active ? "Utente disattivato." : "Utente riattivato.");
    router.refresh();
  }

  async function resetCode(user: Member) {
    setBusyId(user.id);
    setMessage("");
    setIssuedCode(null);

    const res = await fetch("/api/users/" + user.id + "/reset-code", {
      method: "POST"
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

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

  async function deleteUser(user: Member) {
    setBusyId(user.id);
    setMessage("");

    const res = await fetch("/api/users/" + user.id, {
      method: "DELETE"
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      notify(data.error ?? "Impossibile eliminare l'account.", "error");
      return;
    }

    if (editing?.id === user.id) setEditing(null);
    notify("Account eliminato.");
    router.refresh();
  }

  return (
    <div className="stack">
      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminare l'account?"
        message={
          toDelete
            ? toDelete.firstName + " " + toDelete.lastName + " non potrà più accedere."
            : ""
        }
        confirmLabel="Elimina account"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const user = toDelete;
          setToDelete(null);
          if (user) deleteUser(user);
        }}
      />

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

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="edit-user-title">Modifica {editing.firstName} {editing.lastName}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Chiudi" onClick={() => setEditing(null)}>×</button>
            </div>

            <form className="stack" onSubmit={saveUser}>
              <div className="grid">
                <div className="field">
                  <label>Nome</label>
                  <input name="firstName" defaultValue={editing.firstName} required />
                </div>
                <div className="field">
                  <label>Cognome</label>
                  <input name="lastName" defaultValue={editing.lastName} required />
                </div>
                <div className="field">
                  <label>Classe</label>
                  <input name="className" defaultValue={editing.className} required />
                </div>
                <div className="field">
                  <label>Nuovo numero di telefono</label>
                  <input name="phone" inputMode="tel" placeholder="Lascia vuoto per non modificarlo" />
                </div>
                <div className="field">
                  <label>Ruolo</label>
                  <select name="role" defaultValue={editing.role} disabled={editing.id === currentUserId}>
                    <option value="CLASS_REP">Rappresentante di classe</option>
                    <option value="INSTITUTE_REP">Rappresentante d'istituto</option>
                  </select>
                </div>
              </div>

              <div className="row modal-actions">
                <button disabled={busyId === editing.id}>
                  {busyId === editing.id ? "Salvataggio..." : "Salva modifiche"}
                </button>
                <button type="button" className="secondary" onClick={() => setEditing(null)}>Annulla</button>
              </div>
            </form>
          </section>
        </div>
      )}

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
              Modifica account, ruoli, accessi e codici personali.
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

          <div className="meta">{filteredUsers.length} risultati</div>

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
                {filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const busy = busyId === user.id;

                  return (
                    <tr key={user.id}>
                      <td>
                        <span className="user-name">
                          {user.lastName} {user.firstName}
                        </span>
                        {isSelf && <span className="user-role">Il tuo account</span>}
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
                            disabled={busy}
                            onClick={() => {
                              setEditing(user);
                              setIssuedCode(null);
                              setMessage("");
                            }}
                          >
                            Modifica
                          </button>

                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => resetCode(user)}
                          >
                            Nuovo codice
                          </button>

                          {!isSelf && (
                            <button
                              className={user.active ? "secondary" : "ghost"}
                              disabled={busy}
                              onClick={() => toggleActive(user)}
                            >
                              {user.active ? "Disattiva" : "Riattiva"}
                            </button>
                          )}

                          {!isSelf && (
                            <button
                              className="danger"
                              disabled={busy}
                              onClick={() => setToDelete(user)}
                            >
                              Elimina
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="muted">
                        Nessun utente corrisponde ai filtri.
                      </div>
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
