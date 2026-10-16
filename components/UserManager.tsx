"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import RowMenu from "@/components/RowMenu";
import Icon from "@/components/Icon";
import { parseMembersCsv, type ImportRow } from "@/lib/csvMembers";
import { apiFetch } from "@/lib/api";

type ImportResult = {
  line: number;
  name: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  accessCode?: string;
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  role: "CLASS_REP" | "INSTITUTE_REP";
  active: boolean;
  maskedEmail?: string | null;
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
  currentUserId,
  mailEnabled = false
}: {
  users: Member[];
  currentUserId: string;
  mailEnabled?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "CLASS_REP" | "INSTITUTE_REP">("ALL");
  const [issuedCode, setIssuedCode] = useState<{
    name: string;
    code: string;
    emailed?: boolean;
  } | null>(null);
  const [copiedType, setCopiedType] = useState<"code" | "msg" | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Member | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");

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
        roleLabel(user.role) +
        " " +
        (user.maskedEmail ?? "");

      const matchesQuery = !normalized || text.toLowerCase().includes(normalized);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.active) ||
        (statusFilter === "INACTIVE" && !user.active);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchesQuery && matchesStatus && matchesRole;
    });
  }, [users, query, statusFilter, roleFilter]);

  async function copyToClipboard(text: string, type: "code" | "msg") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // Fallback silenzioso
    }
  }

  function closeImport() {
    setImporting(false);
    setImportRows([]);
    setImportResults(null);
    setImportError("");
  }

  async function readFile(file: File | undefined) {
    setImportError("");
    setImportResults(null);
    if (!file) return;
    const rows = parseMembersCsv(await file.text());
    if (rows.length === 0) setImportError("Il file è vuoto.");
    setImportRows(rows);
  }

  async function runImport() {
    setImportBusy(true);
    setImportError("");
    const res = await apiFetch("/api/users/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows: importRows })
    });
    const data = await res.json().catch(() => ({}));
    setImportBusy(false);
    if (!res.ok) {
      setImportError(data.error ?? "Importazione non riuscita");
      return;
    }
    setImportResults(data.results);
    router.refresh();
  }

  function downloadCodes() {
    const lines = (importResults ?? [])
      .filter((item) => item.status === "created")
      .map((item) => item.name + ";" + item.accessCode);
    const blob = new Blob(["nome;codice\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "codici-di-accesso.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

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
    const emailRaw = String(form.get("email") ?? "").trim();

    const res = await apiFetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        className: form.get("className"),
        phone: form.get("phone"),
        email: emailRaw || undefined,
        role: form.get("role")
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      notify(data.error ?? "Impossibile creare l'utente.", "error");
      return;
    }

    setCopiedType(null);
    setIssuedCode({
      name: data.user.firstName + " " + data.user.lastName,
      code: data.accessCode,
      emailed: Boolean(data.emailed)
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

    setCopiedType(null);
    setIssuedCode({
      name: user.firstName + " " + user.lastName,
      code: data.accessCode,
      emailed: Boolean(data.emailed)
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
            ? toDelete.firstName + " " + toDelete.lastName + " non potrà più accedere al portale."
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
        description="Aggiungi un rappresentante: il codice di accesso provvisorio viene generato in automatico."
        onClose={() => setCreating(false)}
      >
        <form className="stack" onSubmit={createUser}>
          <div className="grid">
            <div className="field">
              <label htmlFor="n-first">Nome</label>
              <input id="n-first" name="firstName" placeholder="Mario" required />
            </div>
            <div className="field">
              <label htmlFor="n-last">Cognome</label>
              <input id="n-last" name="lastName" placeholder="Rossi" required />
            </div>
            <div className="field">
              <label htmlFor="n-class">Classe</label>
              <input id="n-class" name="className" placeholder="3B ES" required />
            </div>
            <div className="field">
              <label htmlFor="n-phone">Numero di telefono</label>
              <input id="n-phone" name="phone" inputMode="tel" placeholder="+39 333 123 4567" required />
            </div>
            <div className="field">
              <label htmlFor="n-email">Email di recupero (opzionale)</label>
              <input id="n-email" name="email" type="email" placeholder="mario.rossi@scuola.it" />
              <p className="hint">
                {mailEnabled
                  ? "Se inserita, riceverà in automatico anche il codice provvisorio via email."
                  : "Facoltativa: permette il recupero autonomo e l'accesso con email."}
              </p>
            </div>
            <div className="field">
              <label htmlFor="n-role">Ruolo</label>
              <select id="n-role" name="role" defaultValue="CLASS_REP">
                <option value="CLASS_REP">Rappresentante di classe</option>
                <option value="INSTITUTE_REP">Rappresentante d&apos;istituto</option>
              </select>
            </div>
          </div>

          <div className="row modal-actions">
            <button>Crea account</button>
            <button type="button" className="secondary" onClick={() => setCreating(false)}>
              Annulla
            </button>
            <span className="meta">Il codice provvisorio verrà mostrato subito dopo.</span>
          </div>
        </form>
      </Modal>

      <Modal
        open={importing}
        title="Importa utenti da file CSV"
        description="Formato colonne: nome; cognome; classe; telefono; ruolo (facoltativo); codice (facoltativo). I codici mancanti vengono generati."
        onClose={closeImport}
      >
        {importResults === null ? (
          <div className="stack">
            <div className="field">
              <label htmlFor="import-file">Seleziona file CSV</label>
              <input
                id="import-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
              <p className="hint">Massimo 300 righe. L&apos;intestazione è facoltativa.</p>
            </div>

            {importRows.length > 0 && (
              <div className="notice">
                <Icon name="info" size={18} />
                <div>
                  Pronti da importare: <strong>{importRows.length}</strong> righe. Primo utente:{" "}
                  {importRows[0].lastName} {importRows[0].firstName} ({importRows[0].className}).
                </div>
              </div>
            )}

            {importError && (
              <div className="error-box">
                <Icon name="alert" size={18} />
                <span>{importError}</span>
              </div>
            )}

            <div className="row modal-actions">
              <button disabled={importBusy || importRows.length === 0} onClick={runImport}>
                {importBusy ? "Importazione..." : "Importa " + (importRows.length || "")}
              </button>
              <button type="button" className="secondary" onClick={closeImport}>Annulla</button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="success-box">
              <Icon name="check" size={18} />
              <div>
                Creati <strong>{importResults.filter((r) => r.status === "created").length}</strong> account · saltati{" "}
                {importResults.filter((r) => r.status === "skipped").length} · errori{" "}
                {importResults.filter((r) => r.status === "error").length}.
                <div>I codici generati si vedono una sola volta: scarica ora il file CSV.</div>
              </div>
            </div>

            <div className="table-wrap" style={{ maxHeight: 280, overflow: "auto" }}>
              <table className="table">
                <thead><tr><th>Utente</th><th>Esito</th><th>Codice</th></tr></thead>
                <tbody>
                  {importResults.map((item) => (
                    <tr key={item.line}>
                      <td>{item.name}</td>
                      <td>
                        <span className={"badge " + (item.status === "created" ? "green" : item.status === "skipped" ? "orange" : "red")}>
                          {item.status === "created" ? "Creato" : item.reason}
                        </span>
                      </td>
                      <td><code>{item.accessCode ?? ""}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row modal-actions">
              <button onClick={downloadCodes} disabled={!importResults.some((r) => r.status === "created")}>
                <Icon name="download" size={17} /> Scarica i codici (CSV)
              </button>
              <button type="button" className="secondary" onClick={closeImport}>Chiudi</button>
            </div>
          </div>
        )}
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
                  placeholder="Lascia vuoto per non modificarlo"
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
                  <option value="INSTITUTE_REP">Rappresentante d&apos;istituto</option>
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
        <section className="flash success-box issued-code-banner">
          <div className="issued-code-banner-main">
            <div className="row" style={{ gap: 8 }}>
              <strong>Codice provvisorio per {issuedCode.name}</strong>
              {issuedCode.emailed && (
                <span className="badge green">
                  <Icon name="mail" size={12} /> Inviato anche via email
                </span>
              )}
            </div>
            <div className="issued-code">{issuedCode.code}</div>
            <div className="meta" style={{ color: "inherit", opacity: 0.85 }}>
              {issuedCode.emailed
                ? "Il codice è stato inviato automaticamente all'email dell'utente, ma puoi anche copiarlo qui sotto."
                : "Copialo ora e consegnalo all'utente: nel database viene salvato solo l'hash crittografico."}
            </div>
          </div>
          <div className="row">
            <button
              type="button"
              className="secondary small"
              onClick={() => copyToClipboard(issuedCode.code, "code")}
            >
              <Icon name={copiedType === "code" ? "check" : "copy"} size={16} />
              <span>{copiedType === "code" ? "Codice copiato!" : "Copia codice"}</span>
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={() =>
                copyToClipboard(
                  `Ciao ${issuedCode.name}, il tuo codice provvisorio per il portale del Comitato Studentesco è: ${issuedCode.code}`,
                  "msg"
                )
              }
            >
              <Icon name={copiedType === "msg" ? "check" : "copy"} size={16} />
              <span>{copiedType === "msg" ? "Messaggio copiato!" : "Copia messaggio"}</span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Chiudi avviso codice"
              onClick={() => setIssuedCode(null)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </section>
      )}

      {message && !issuedCode && (
        <div className={"flash " + (messageType === "success" ? "success-box" : "error-box")}>
          <Icon name={messageType === "success" ? "check" : "alert"} size={18} />
          <span>{message}</span>
        </div>
      )}

      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, cognome, classe o email..."
              aria-label="Cerca utenti"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                aria-label="Cancella ricerca"
                onClick={() => setQuery("")}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>

          <div className="row">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "ALL" | "CLASS_REP" | "INSTITUTE_REP")}
              aria-label="Filtra per ruolo"
            >
              <option value="ALL">Tutti i ruoli</option>
              <option value="INSTITUTE_REP">Rappr. d&apos;istituto</option>
              <option value="CLASS_REP">Rappr. di classe</option>
            </select>

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

            <button className="secondary" onClick={() => setImporting(true)}>
              <Icon name="file" size={17} /> Importa CSV
            </button>

            <button onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> Nuovo account
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rappresentante</th>
                <th>Classe</th>
                <th>Ruolo</th>
                <th>Email recupero</th>
                <th>Stato</th>
                <th className="actions"><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyId === user.id;
                const initials = ((user.lastName[0] ?? "") + (user.firstName[0] ?? "")).toUpperCase();

                return (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar avatar-sm" aria-hidden="true">{initials}</span>
                        <div>
                          <span className="user-name">
                            {user.lastName} {user.firstName}
                          </span>
                          {isSelf && <span className="user-role">Il tuo account</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className="badge gray">{user.className}</span></td>
                    <td>
                      <span className={"badge " + roleBadge(user.role)}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      {user.maskedEmail ? (
                        <span className="badge green" title="Email di recupero e accesso configurata">
                          <Icon name="mail" size={12} /> {user.maskedEmail}
                        </span>
                      ) : (
                        <span className="badge gray" title="Nessuna email di recupero associata">
                          Non impostata
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={"badge " + (user.active ? "green" : "red")}>
                        {user.active ? "Attivo" : "Disattivato"}
                      </span>
                    </td>
                    <td className="actions">
                      <div className="row">
                        <button
                          className="secondary small"
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
                              label: "Rigenera codice di accesso",
                              disabled: busy,
                              onSelect: () => resetCode(user)
                            },
                            ...(isSelf
                              ? []
                              : [
                                  {
                                    label: user.active ? "Disattiva account" : "Riattiva account",
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
                  <td colSpan={6}>
                    <div className="muted" style={{ padding: "12px 0", textAlign: "center" }}>
                      Nessun utente corrisponde ai filtri selezionati.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="list-foot">
          Mostrati {filteredUsers.length} di {users.length} account registrati
        </div>
      </section>
    </div>
  );
}
