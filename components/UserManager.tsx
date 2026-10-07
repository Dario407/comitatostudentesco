"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import RowMenu from "@/components/RowMenu";
import Icon from "@/components/Icon";
import { apiFetch } from "@/lib/api";

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
  const [creating, setCreating] = useState(false);

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

    const res = await apiFetch("/api/users", {
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
    setCreating(false);
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

    const res = await apiFetch("/api/users/" + editing.id, {
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

    const res = await apiFetch("/api/users/" + user.id, {
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

    const res = await apiFetch("/api/users/" + user.id + "/reset-code", {
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

    const res = await apiFetch("/api/users/" + user.id, {
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
    <div>
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

      <Modal
        open={creating}
        title="Nuovo account"
        description="Aggiungi un rappresentante: il codice di accesso viene generato in automatico."
        onClose={() => setCreating(false)}
      >
        <form className="stack" onSubmit={createUser}>
          <div className="grid">
            <div className="field">
              <label htmlFor="n-first">Nome</label>
              <input id="n-first" name="firstName" placeholder="Nome" required />
            </div>
            <div className="field">
              <label htmlFor="n-last">Cognome</label>
              <input id="n-last" name="lastName" placeholder="Cognome" required />
            </div>
            <div className="field">
              <label htmlFor="n-class">Classe</label>
              <input id="n-class" name="className" placeholder="3BES" required />
            </div>
            <div className="field">
              <label htmlFor="n-phone">Numero di telefono</label>
              <input id="n-phone" name="phone" inputMode="tel" placeholder="+39 3..." required />
            </div>
            <div className="field">
              <label htmlFor="n-role">Ruolo</label>
              <select id="n-role" name="role" defaultValue="CLASS_REP">
                <option value="CLASS_REP">Rappresentante di classe</option>
                <option value="INSTITUTE_REP">Rappresentante d'istituto</option>
              </select>
            </div>
          </div>

          <div className="row modal-actions">
            <button>Crea account</button>
            <button type="button" className="secondary" onClick={() => setCreating(false)}>
              Annulla
            </button>
            <span className="meta">Il codice verrà mostrato una sola volta.</span>
          </div>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        title={editing ? "Modifica " + editing.firstName + " " + editing.lastName : ""}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form className="stack" onSubmit={saveUser} key={editing.id}>
            <div className="grid">
              <div className="field">
                <label htmlFor="e-first">Nome</label>
                <input id="e-first" name="firstName" defaultValue={editing.firstName} required />
              </div>
              <div className="field">
                <label htmlFor="e-last">Cognome</label>
                <input id="e-last" name="lastName" defaultValue={editing.lastName} required />
              </div>
              <div className="field">
                <label htmlFor="e-class">Classe</label>
                <input id="e-class" name="className" defaultValue={editing.className} required />
              </div>
              <div className="field">
                <label htmlFor="e-phone">Nuovo numero di telefono</label>
                <input
                  id="e-phone"
                  name="phone"
                  inputMode="tel"
                  placeholder="Vuoto: resta quello attuale"
                />
              </div>
              <div className="field">
                <label htmlFor="e-role">Ruolo</label>
                <select
                  id="e-role"
                  name="role"
                  defaultValue={editing.role}
                  disabled={editing.id === currentUserId}
                >
                  <option value="CLASS_REP">Rappresentante di classe</option>
                  <option value="INSTITUTE_REP">Rappresentante d'istituto</option>
                </select>
              </div>
            </div>

            <div className="row modal-actions">
              <button disabled={busyId === editing.id}>
                {busyId === editing.id ? "Salvataggio..." : "Salva modifiche"}
              </button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Annulla
              </button>
            </div>
          </form>
        )}
      </Modal>

      {issuedCode && (
        <section className="flash success-box">
          <strong>Codice di accesso per {issuedCode.name}</strong>
          <div className="issued-code">{issuedCode.code}</div>
          <div>
            Copialo ora e consegnalo all'utente. Nel database viene conservato
            solo l'hash.
          </div>
        </section>
      )}

      {message && !issuedCode && (
        <div className={"flash " + (messageType === "success" ? "success-box" : "error-box")}>
          {message}
        </div>
      )}

      <section>
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, classe o ruolo"
              aria-label="Cerca utenti"
            />
          </div>

          <div className="row">
            <div className="segmented" role="group" aria-label="Filtra per stato">
              {(
                [
                  ["ALL", "Tutti"],
                  ["ACTIVE", "Attivi"],
                  ["INACTIVE", "Disattivati"]
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={statusFilter === value ? "active" : ""}
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> Nuovo account
            </button>
          </div>
        </div>

        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Utente</th>
                <th>Classe</th>
                <th>Ruolo</th>
                <th>Stato</th>
                <th className="actions"><span className="sr-only">Azioni</span></th>
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
                    <td className="actions">
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

                        <RowMenu
                          label={"Altre azioni per " + user.firstName + " " + user.lastName}
                          items={[
                            {
                              label: "Nuovo codice di accesso",
                              disabled: busy,
                              onSelect: () => resetCode(user)
                            },
                            ...(isSelf
                              ? []
                              : [
                                  {
                                    label: user.active ? "Disattiva" : "Riattiva",
                                    disabled: busy,
                                    onSelect: () => toggleActive(user)
                                  },
                                  {
                                    label: "Elimina account",
                                    danger: true,
                                    disabled: busy,
                                    onSelect: () => setToDelete(user)
                                  }
                                ])
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

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

        <div className="meta" style={{ marginTop: 10 }}>
          {filteredUsers.length} risultati
        </div>
      </section>
    </div>
  );
}
