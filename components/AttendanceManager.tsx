"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setPresence(userId: string, present: boolean) {
    setSavingId(userId);
    setError("");

    setMembers((items) =>
      items.map((item) =>
        item.id === userId ? { ...item, present } : item
      )
    );

    const res = await apiFetch("/api/meetings/" + meetingId + "/attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, present })
    });

    setSavingId(null);

    if (!res.ok) {
      setMembers((items) =>
        items.map((item) =>
          item.id === userId ? { ...item, present: !present } : item
        )
      );
      setError("Impossibile aggiornare la presenza. Riprova.");
    }
  }

  const visible = useMemo(
    () =>
      members.filter((member) =>
        (member.firstName + " " + member.lastName + " " + member.className)
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [members, query]
  );

  const presentCount = members.filter((item) => item.present).length;
  const absentCount = members.length - presentCount;
  const attendanceRate =
    members.length === 0 ? 0 : Math.round((presentCount / members.length) * 100);

  return (
    <div className="stack">
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Presenti</div>
          <div className="kpi">{presentCount}</div>
          <div className="stat-sub">Rappresentanti registrati presenti</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Assenti</div>
          <div className="kpi">{absentCount}</div>
          <div className="stat-sub">Rappresentanti non presenti</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Partecipazione</div>
          <div className="kpi">{attendanceRate}%</div>
          <div className="stat-sub">Sul totale degli aventi diritto</div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Registro presenze</h2>
            <div className="section-subtitle">
              Le modifiche vengono salvate immediatamente.
            </div>
          </div>
          <span className="badge green">{presentCount} presenti</span>
        </div>

        <div className="card stack">
          {error && <div className="error-box" role="alert">{error}</div>}

          <div className="search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca nome o classe..."
            />
            <span className="badge gray">{visible.length} risultati</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Presenza</th>
                  <th>Nome</th>
                  <th>Classe</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <label className="attendance-toggle">
                        <input
                          type="checkbox"
                          checked={member.present}
                          disabled={savingId === member.id}
                          onChange={(e) =>
                            setPresence(member.id, e.target.checked)
                          }
                        />
                        <span>{member.present ? "Presente" : "Assente"}</span>
                      </label>
                    </td>
                    <td>
                      <span className="user-name">
                        {member.lastName} {member.firstName}
                      </span>
                    </td>
                    <td>{member.className}</td>
                    <td>
                      <span className={"badge " + (member.present ? "green" : "gray")}>
                        {savingId === member.id
                          ? "Salvataggio..."
                          : member.present
                            ? "Registrato"
                            : "Non presente"}
                      </span>
                    </td>
                  </tr>
                ))}

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="muted">Nessun risultato.</div>
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
