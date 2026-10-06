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

function statusLabel(status: string) {
  if (status === "OPEN") return "Aperta";
  if (status === "CLOSED") return "Chiusa";
  return "Bozza";
}

function statusClass(status: string) {
  if (status === "OPEN") return "green";
  if (status === "CLOSED") return "gray";
  return "orange";
}

export default function AdminPanel({
  meetings,
  polls
}: {
  meetings: Meeting[];
  polls: Poll[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busyId, setBusyId] = useState<string | null>(null);

  function notify(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

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

    if (!res.ok) {
      notify("Errore nella creazione della seduta.", "error");
      return;
    }

    notify("Seduta creata.");
    formEl.reset();
    router.refresh();
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

    if (!res.ok) {
      notify(data.error ?? "Errore nella creazione della votazione.", "error");
      return;
    }

    notify("Votazione creata.");
    formEl.reset();
    router.refresh();
  }

  async function changeStatus(id: string, status: "OPEN" | "CLOSED") {
    setBusyId(id);

    const res = await fetch("/api/polls/" + id + "/status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });

    setBusyId(null);

    if (!res.ok) {
      notify("Impossibile modificare lo stato della votazione.", "error");
      return;
    }

    notify(status === "OPEN" ? "Votazione aperta." : "Votazione chiusa.");
    router.refresh();
  }

  async function deleteMeeting(meeting: Meeting) {
    const confirmed = window.confirm(
      'Eliminare la seduta "' +
        meeting.title +
        '"? Le presenze registrate verranno eliminate. Se ci sono votazioni collegate, dovrai eliminarle prima.'
    );

    if (!confirmed) return;

    setBusyId(meeting.id);

    const res = await fetch("/api/meetings/" + meeting.id, {
      method: "DELETE"
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      notify(data.error ?? "Impossibile eliminare la seduta.", "error");
      return;
    }

    notify("Seduta eliminata.");
    router.refresh();
  }

  async function deletePoll(poll: Poll) {
    const confirmed = window.confirm(
      'Eliminare definitivamente la votazione "' +
        poll.title +
        '"? Verranno eliminati anche voti, partecipazioni e risultati collegati.'
    );

    if (!confirmed) return;

    setBusyId(poll.id);

    const res = await fetch("/api/polls/" + poll.id, {
      method: "DELETE"
    });

    const data = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      notify(data.error ?? "Impossibile eliminare la votazione.", "error");
      return;
    }

    notify("Votazione eliminata.");
    router.refresh();
  }

  return (
    <>
      {message && (
        <div className={messageType === "success" ? "success-box" : "error-box"}>
          {message}
        </div>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Sedute</h2>
            <div className="section-subtitle">
              Crea una seduta e registra le presenze dei rappresentanti.
            </div>
          </div>
        </div>

        <div className="split-layout">
          <form className="card stack form-card" onSubmit={createMeeting}>
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Nuova seduta</h3>
                <p className="panel-subtitle">Imposta titolo, data e ora.</p>
              </div>
              <span className="badge">Nuova</span>
            </div>

            <div className="field">
              <label>Titolo</label>
              <input name="title" placeholder="Comitato studentesco" required />
            </div>

            <div className="field">
              <label>Data e ora</label>
              <input name="startsAt" type="datetime-local" required />
            </div>

            <button>Crea seduta</button>
          </form>

          <div className="stack">
            {meetings.length === 0 ? (
              <div className="empty-state">
                <div>
                  <strong>Nessuna seduta</strong>
                  Crea la prima seduta per iniziare a registrare le presenze.
                </div>
              </div>
            ) : (
              meetings.slice(0, 5).map((meeting) => (
                <div className="card meeting-card stack" key={meeting.id}>
                  <div>
                    <div className="eyebrow">Seduta</div>
                    <h3>{meeting.title}</h3>
                    <div className="meeting-date">
                      {new Date(meeting.startsAt).toLocaleString("it-IT", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </div>
                  </div>

                  <div className="row">
                    <a
                      className="button secondary"
                      href={"/admin/meetings/" + meeting.id}
                    >
                      Gestisci presenze
                    </a>
                    <button
                      className="danger"
                      disabled={busyId === meeting.id}
                      onClick={() => deleteMeeting(meeting)}
                    >
                      {busyId === meeting.id ? "Eliminazione..." : "Elimina"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Crea una votazione</h2>
            <div className="section-subtitle">
              Definisci modalità, riservatezza e opzioni di voto.
            </div>
          </div>
        </div>

        <form className="card stack" onSubmit={createPoll}>
          <div className="field">
            <label>Titolo</label>
            <input name="title" placeholder="Titolo della votazione" required />
          </div>

          <div className="field">
            <label>Descrizione</label>
            <textarea
              name="description"
              placeholder="Aggiungi una breve descrizione o il testo della proposta..."
            />
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
            <label>Seduta collegata</label>
            <select name="meetingId" defaultValue="">
              <option value="">Nessuna - necessaria solo per il voto in presenza</option>
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

          <div className="row">
            <button>Crea votazione</button>
            <span className="meta">
              Puoi lasciarla in bozza e aprirla successivamente.
            </span>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Votazioni</h2>
            <div className="section-subtitle">
              Controlla stato, risultati e apertura delle votazioni.
            </div>
          </div>
          <span className="badge gray">{polls.length} totali</span>
        </div>

        {polls.length === 0 ? (
          <div className="empty-state">
            <div>
              <strong>Nessuna votazione</strong>
              Le votazioni create compariranno qui.
            </div>
          </div>
        ) : (
          <div className="stack">
            {polls.map((poll) => (
              <div className="card poll-admin-card" key={poll.id}>
                <div className="poll-admin-main">
                  <strong>{poll.title}</strong>
                  <div className="row">
                    <span className={"badge " + statusClass(poll.status)}>
                      {statusLabel(poll.status)}
                    </span>
                    <span className="badge gray">
                      {poll.mode === "IN_PERSON" ? "In presenza" : "Asincrono"}
                    </span>
                    <span className="badge gray">
                      {poll.visibility === "SECRET" ? "Segreto" : "Palese"}
                    </span>
                  </div>
                </div>

                <div className="row">
                  <a
                    className="button secondary"
                    href={"/admin/polls/" + poll.id}
                  >
                    Risultati
                  </a>

                  {poll.status !== "OPEN" && (
                    <button
                      disabled={busyId === poll.id}
                      onClick={() => changeStatus(poll.id, "OPEN")}
                    >
                      Apri
                    </button>
                  )}

                  {poll.status !== "CLOSED" && (
                    <button
                      className="secondary"
                      disabled={busyId === poll.id}
                      onClick={() => changeStatus(poll.id, "CLOSED")}
                    >
                      Chiudi
                    </button>
                  )}

                  <button
                    className="danger"
                    disabled={busyId === poll.id}
                    onClick={() => deletePoll(poll)}
                  >
                    {busyId === poll.id ? "Operazione..." : "Elimina"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
