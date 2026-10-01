"use client";

import { useState } from "react";

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

  async function setPresence(userId: string, present: boolean) {
    setMembers((items) =>
      items.map((item) =>
        item.id === userId ? { ...item, present } : item
      )
    );

    const res = await fetch(`/api/meetings/${meetingId}/attendance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, present })
    });

    if (!res.ok) {
      setMembers((items) =>
        items.map((item) =>
          item.id === userId ? { ...item, present: !present } : item
        )
      );
      alert("Impossibile aggiornare la presenza.");
    }
  }

  const visible = members.filter((member) =>
    `${member.firstName} ${member.lastName} ${member.className}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="stack">
      <div className="row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca nome o classe..."
        />
        <span className="badge green">
          {members.filter((item) => item.present).length} presenti
        </span>
      </div>

      <table className="table card">
        <thead>
          <tr>
            <th>Presente</th>
            <th>Nome</th>
            <th>Classe</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((member) => (
            <tr key={member.id}>
              <td>
                <input
                  type="checkbox"
                  checked={member.present}
                  onChange={(e) =>
                    setPresence(member.id, e.target.checked)
                  }
                />
              </td>
              <td>
                {member.lastName} {member.firstName}
              </td>
              <td>{member.className}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
