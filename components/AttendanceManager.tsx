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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

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
      members.filter(
        (member) =>
          (member.firstName + " " + member.lastName + " " + member.className)
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === "ALL" || (filter === "PRESENT" ? member.present : !member.present))
      ),
    [members, query, filter]
  );

  const presentCount = members.filter((item) => item.present).length;
  const absentCount = members.length - presentCount;
  const attendanceRate =
    members.length === 0 ? 0 : Math.round((presentCount / members.length) * 100);

  return (
    <div>
      <Metrics
        items={[
          { label: "Presenti", value: presentCount, hint: "Registrati in seduta" },
          { label: "Assenti", value: absentCount, hint: "Non ancora segnati" },
          { label: "Partecipazione", value: attendanceRate + "%", hint: "Sugli aventi diritto" }
        ]}
      />

      {error && <div className="flash error-box" role="alert">{error}</div>}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca nome o classe"
            aria-label="Cerca rappresentante"
          />
        </div>

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

      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Rappresentante</th>
              <th>Classe</th>
              <th className="actions">Presenza</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((member) => (
              <tr key={member.id}>
                <td>
                  <span className="user-name">
                    {member.lastName} {member.firstName}
                  </span>
                </td>
                <td>{member.className}</td>
                <td className="actions">
                  <label className="switch">
                    <span className="muted">
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
            ))}

            {visible.length === 0 && (
              <tr>
                <td colSpan={3}>
                  <div className="muted">Nessun risultato.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="meta" style={{ marginTop: 10 }}>
        Le modifiche vengono salvate subito.
      </p>
    </div>
  );
}
