"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Meeting = {
  id: string;
  title: string;
  startsAt: string;
};

type Poll = {
  id: string;
  title: string;
  status: string;
  mode: string;
  visibility: string;
};

export default function AdminPanel({
  meetings,
  polls
}: {
  meetings: Meeting[];
  polls: Poll[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function createMeeting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const local = String(form.get("startsAt"));
    const startsAt = new Date(local).toISOString();

    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        startsAt
      })
    });

    setMessage(
      res.ok ? "Seduta creata." : "Errore nella creazione della seduta."
    );

    if (res.ok) {
      formEl.reset();
      router.refresh();
    }
  }

  async function createPoll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const options = String(form.get("options"))
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const body = {
      title: form.get("title"),
      description: form.get("description"),
      mode: form.get("mode"),
      visibility: form.get("visibility"),
      status: form.get("status"),
      meetingId: form.get("meetingId") || null,
      options
    };

    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    setMessage(
      res.ok ? "Votazione creata." : data.error ?? "Errore nella creazione."
    );

    if (res.ok) {
      formEl.reset();
      router.refresh();
    }
  }

  async function changeStatus(id: string, status: "OPEN" | "CLOSED") {
    const res = await fetch(`/api/polls/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      setMessage("Impossibile modificare lo stato della votazione.");
      return;
    }

    router.refresh();
  }

  return (
    <>
      {message && <p className="success">{message}</p>}

      <h2 className="section-title">Nuova seduta</h2>
      <form className="card stack" onSubmit={createMeeting}>
        <div className="field">
          <label>Titolo</label>
          <input name="title" required />
        </div>

        <div className="field">
          <label>Data e ora</label>
          <input name="startsAt" type="datetime-local" required />
        </div>

        <button>Crea seduta</button>
      </form>

      <h2 className="section-title">Sedute</h2>
      <div className="grid">
        {meetings.map((meeting) => (
          <a
            className="card"
            href={`/admin/meetings/${meeting.id}`}
            key={meeting.id}
          >
            <h3>{meeting.title}</h3>
            <div className="muted">
              {new Date(meeting.startsAt).toLocaleString("it-IT")}
            </div>
            <p>
              <span className="badge">Gestisci presenze</span>
            </p>
          </a>
        ))}
      </div>

      <h2 className="section-title">Nuova votazione</h2>
      <form className="card stack" onSubmit={createPoll}>
        <div className="field">
          <label>Titolo</label>
          <input name="title" required />
        </div>

        <div className="field">
          <label>Descrizione</label>
          <textarea name="description" />
        </div>

        <div className="grid">
          <div className="field">
            <label>Modalità</label>
            <select name="mode" defaultValue="ASYNC">
              <option value="ASYNC">Asincrono</option>
              <option value="IN_PERSON">In presenza</option>
            </select>
          </div>

          <div className="field">
            <label>Tipo di voto</label>
            <select name="visibility" defaultValue="NAMED">
              <option value="NAMED">Palese</option>
              <option value="SECRET">Segreto</option>
            </select>
          </div>

          <div className="field">
            <label>Stato iniziale</label>
            <select name="status" defaultValue="DRAFT">
              <option value="DRAFT">Bozza</option>
              <option value="OPEN">Aperta</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Seduta - necessaria solo per il voto in presenza</label>
          <select name="meetingId" defaultValue="">
            <option value="">Nessuna</option>
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Opzioni - una per riga</label>
          <textarea
            name="options"
            placeholder={"Favorevole\nContrario\nAstenuto"}
            required
          />
        </div>

        <button>Crea votazione</button>
      </form>

      <h2 className="section-title">Votazioni</h2>
      <div className="stack">
        {polls.map((poll) => (
          <div
            className="card row"
            key={poll.id}
            style={{ justifyContent: "space-between" }}
          >
            <div>
              <strong>{poll.title}</strong>
              <div className="muted">
                {poll.mode === "IN_PERSON" ? "In presenza" : "Asincrono"} ·{" "}
                {poll.visibility === "SECRET" ? "Segreto" : "Palese"} ·{" "}
                {poll.status}
              </div>
            </div>

            <div className="row">
              <a
                className="button secondary"
                href={`/admin/polls/${poll.id}`}
              >
                Risultati
              </a>

              {poll.status !== "OPEN" && (
                <button onClick={() => changeStatus(poll.id, "OPEN")}>
                  Apri
                </button>
              )}

              {poll.status !== "CLOSED" && (
                <button
                  className="danger"
                  onClick={() => changeStatus(poll.id, "CLOSED")}
                >
                  Chiudi
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
