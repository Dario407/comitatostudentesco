"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import Metrics from "@/components/Metrics";
import Icon from "@/components/Icon";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  present: boolean;
};

export default function AttendanceManager({
  meetingId,
  initial
}: {
  meetingId: string;
  initial: Member[];
}) {
  const [members, setMembers] = useState(initial);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

  const classes = useMemo(() => {
    const set = new Set(members.map((m) => m.className));
    return [...set].sort((a, b) => a.localeCompare(b, "it", { numeric: true }));
  }, [members]);

  async function setPresence(userId: string, present: boolean) {
    setSavingId(userId);
    setError("");

    setMembers((items) =>
      items.map((item) => (item.id === userId ? { ...item, present } : item))
    );

    const res = await apiFetch("/api/meetings/" + meetingId + "/attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, present })
    });

    setSavingId(null);

    if (!res.ok) {
      setMembers((items) =>
        items.map((item) => (item.id === userId ? { ...item, present: !present } : item))
      );
      setError("Impossibile aggiornare la presenza. Riprova.");
    }
  }

  const visible = useMemo(
    () =>
      members.filter(
        (member) =>
          (member.firstName + " " + member.lastName + " " + member.className)
            .toLowerCase()
            .includes(query.trim().toLowerCase()) &&
          (classFilter === "ALL" || member.className === classFilter) &&
          (filter === "ALL" || (filter === "PRESENT" ? member.present : !member.present))
      ),
    [members, query, classFilter, filter]
  );

  const presentCount = members.filter((item) => item.present).length;
  const absentCount = members.length - presentCount;
  const attendanceRate =
    members.length === 0 ? 0 : Math.round((presentCount / members.length) * 100);
  const quorumTarget = members.length === 0 ? 0 : Math.floor(members.length / 2) + 1;
  const quorumReached = presentCount >= quorumTarget && members.length > 0;

  return (
    <div>
      <Metrics
        items={[
          { label: "Presenti in aula", value: presentCount, hint: "Abilitati al voto in presenza" },
          { label: "Assenti", value: absentCount, hint: "Non ancora registrati" },
          {
            label: "Affluenza seduta",
            value: attendanceRate + "%",
            hint: quorumReached
              ? "Metà più uno superata (" + quorumTarget + ")"
              : "Metà più uno a " + quorumTarget + " presenti"
          }
        ]}
      />

      <div className="panel attendance-progress-card">
        <div className="attendance-progress-head">
          <span>
            <strong>Stato appello:</strong> {presentCount} presenti su {members.length} aventi diritto
          </span>
          <span className={"badge " + (quorumReached ? "green" : "orange")}>
            {quorumReached ? "Numero legale raggiunto" : "Mancano " + Math.max(0, quorumTarget - presentCount) + " per la metà più uno"}
          </span>
        </div>
        <div className="progress">
          <span style={{ width: attendanceRate + "%" }} />
        </div>
      </div>

      {error && (
        <div className="flash error-box" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per cognome, nome o classe..."
              aria-label="Cerca rappresentante"
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
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Filtra per classe"
            >
              <option value="ALL">Tutte le classi ({classes.length})</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  Classe {cls}
                </option>
              ))}
            </select>

            <div className="segmented" role="group" aria-label="Filtra per presenza">
              {(
                [
                  ["ALL", "Tutti", members.length],
                  ["PRESENT", "Presenti", presentCount],
                  ["ABSENT", "Assenti", absentCount]
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  <span className="count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rappresentante</th>
                <th>Classe</th>
                <th className="actions">Stato presenza</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => {
                const initials = (
                  (member.lastName[0] ?? "") + (member.firstName[0] ?? "")
                ).toUpperCase();

                return (
                  <tr
                    key={member.id}
                    className={member.present ? "row-present" : ""}
                  >
                    <td>
                      <div className="user-cell">
                        <span
                          className={"avatar avatar-sm" + (member.present ? " avatar-present" : "")}
                          aria-hidden="true"
                        >
                          {initials}
                        </span>
                        <span className="user-name">
                          {member.lastName} {member.firstName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge gray">{member.className}</span>
                    </td>
                    <td className="actions">
                      <label className="switch">
                        <span
                          className={
                            "badge " +
                            (savingId === member.id
                              ? "gray"
                              : member.present
                                ? "green"
                                : "gray")
                          }
                        >
                          {savingId === member.id
                            ? "Salvataggio..."
                            : member.present
                              ? "Presente"
                              : "Assente"}
                        </span>
                        <input
                          type="checkbox"
                          checked={member.present}
                          disabled={savingId === member.id}
                          onChange={(e) => setPresence(member.id, e.target.checked)}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <div className="muted" style={{ padding: "12px 0", textAlign: "center" }}>
                      Nessun rappresentante trovato con i filtri attuali.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="list-foot">
          Mostrati {visible.length} di {members.length} rappresentanti · Le presenze sono salvate in tempo reale.
        </div>
      </div>
    </div>
  );
}
