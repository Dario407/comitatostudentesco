"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import RowMenu from "@/components/RowMenu";
import Icon from "@/components/Icon";
import { apiFetch } from "@/lib/api";
import { formatDateTime, romeLocalToISO } from "@/lib/datetime";

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
  polls,
  closedTotal
}: {
  meetings: Meeting[];
  polls: Poll[];
  closedTotal: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [modal, setModal] = useState<"meeting" | "poll" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    title: string;
    message: string;
    label: string;
    danger: boolean;
    run: () => void;
  } | null>(null);

  function notify(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function createMeeting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    let startsAt: string;

    try {
      startsAt = romeLocalToISO(String(form.get("startsAt")));
    } catch {
      notify("Data e ora non valide.", "error");
      return;
    }

    const res = await apiFetch("/api/meetings", {
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
    setModal(null);
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

    const res = await apiFetch("/api/polls", {
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
    setModal(null);
    formEl.reset();
    router.refresh();
  }

  async function changeStatus(id: string, status: "OPEN" | "CLOSED") {
    setBusyId(id);

    const res = await apiFetch("/api/polls/" + id + "/status", {
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

  function closeMeeting(meeting: Meeting) {
    setPending({
      title: "Archiviare la seduta?",
      message: "«" + meeting.title + "» resterà consultabile nell'Archivio.",
      label: "Archivia",
      danger: false,
      run: () => runCloseMeeting(meeting)
    });
  }

  async function runCloseMeeting(meeting: Meeting) {
    setBusyId(meeting.id);
    const res = await apiFetch("/api/meetings/" + meeting.id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" })
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      notify(data.error ?? "Impossibile archiviare la seduta.", "error");
      return;
    }
    notify("Seduta archiviata.");
    router.refresh();
  }

  function deleteMeeting(meeting: Meeting) {
    setPending({
      title: "Eliminare la seduta?",
      message:
        "«" + meeting.title + "»: le presenze registrate verranno eliminate. " +
        "Se ci sono votazioni collegate, dovrai eliminarle prima.",
      label: "Elimina seduta",
      danger: true,
      run: () => runDeleteMeeting(meeting)
    });
  }

  async function runDeleteMeeting(meeting: Meeting) {
    setBusyId(meeting.id);

    const res = await apiFetch("/api/meetings/" + meeting.id, {
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

  function deletePoll(poll: Poll) {
    setPending({
      title: "Eliminare la votazione?",
      message:
        "«" + poll.title + "» verrà eliminata definitivamente, insieme a voti, " +
        "partecipazioni e risultati collegati.",
      label: "Elimina votazione",
      danger: true,
      run: () => runDeletePoll(poll)
    });
  }

  async function runDeletePoll(poll: Poll) {
    setBusyId(poll.id);

    const res = await apiFetch("/api/polls/" + poll.id, {
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

  const hiddenClosed = closedTotal - polls.filter((poll) => poll.status === "CLOSED").length;

  return (
    <>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        message={pending?.message ?? ""}
        confirmLabel={pending?.label}
        danger={pending?.danger}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending?.run;
          setPending(null);
          action?.();
        }}
      />

      {message && (
        <div className={"flash " + (messageType === "success" ? "success-box" : "error-box")}>
          {message}
        </div>
      )}

      <div className="split">
        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">Votazioni</h2>
              <p className="section-note">Stato, risultati e apertura.</p>
            </div>
            <button onClick={() => setModal("poll")}>
              <Icon name="plus" size={18} /> Nuova votazione
            </button>
          </div>

          {polls.length === 0 ? (
            <div className="empty-state">
              <div>
                <strong>Nessuna votazione</strong>
                Le votazioni create compariranno qui.
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {polls.map((poll) => (
                <div className="item" key={poll.id}>
                  <div className="item-main">
                    <div className="item-title">{poll.title}</div>
                    <div className="item-meta">
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

                  <div className="item-actions">
                    <Link className="button secondary" href={"/admin/polls/" + poll.id}>
                      Risultati
                    </Link>

                    {poll.status !== "OPEN" && (
                      <button
                        disabled={busyId === poll.id}
                        onClick={() => changeStatus(poll.id, "OPEN")}
                      >
                        Apri
                      </button>
                    )}

                    {poll.status === "OPEN" && (
                      <button
                        className="secondary"
                        disabled={busyId === poll.id}
                        onClick={() => changeStatus(poll.id, "CLOSED")}
                      >
                        Chiudi
                      </button>
                    )}

                    <RowMenu
                      label={"Altre azioni per " + poll.title}
                      items={[
                        ...(poll.status === "DRAFT"
                          ? [
                              {
                                label: "Segna come chiusa",
                                onSelect: () => changeStatus(poll.id, "CLOSED"),
                                disabled: busyId === poll.id
                              }
                            ]
                          : []),
                        {
                          label: "Elimina",
                          danger: true,
                          disabled: busyId === poll.id,
                          onSelect: () => deletePoll(poll)
                        }
                      ]}
                    />
                  </div>
                </div>
              ))}

              {hiddenClosed > 0 && (
                <div className="list-foot">
                  Mostrate solo le ultime chiuse: altre {hiddenClosed} sono nell'
                  <Link href="/archivio">Archivio</Link>.
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">Sedute aperte</h2>
              <p className="section-note">Presenze dei rappresentanti.</p>
            </div>
            <button className="secondary" onClick={() => setModal("meeting")}>
              <Icon name="plus" size={18} /> Nuova
            </button>
          </div>

          {meetings.length === 0 ? (
            <div className="empty-state">
              <div>
                <strong>Nessuna seduta</strong>
                Crea la prima seduta per registrare le presenze.
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {meetings.slice(0, 5).map((meeting) => (
                <div className="item" key={meeting.id}>
                  <div className="item-main">
                    <div className="item-title">{meeting.title}</div>
                    <div className="item-sub">{formatDateTime(meeting.startsAt)}</div>
                  </div>

                  <div className="item-actions">
                    <Link className="button secondary" href={"/admin/meetings/" + meeting.id}>
                      Presenze
                    </Link>
                    <RowMenu
                      label={"Altre azioni per " + meeting.title}
                      items={[
                        {
                          label: "Archivia",
                          disabled: busyId === meeting.id,
                          onSelect: () => closeMeeting(meeting)
                        },
                        {
                          label: "Elimina",
                          danger: true,
                          disabled: busyId === meeting.id,
                          onSelect: () => deleteMeeting(meeting)
                        }
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal
        open={modal === "meeting"}
        title="Nuova seduta"
        description="Imposta titolo, data e ora."
        onClose={() => setModal(null)}
      >
        <form className="stack" onSubmit={createMeeting}>
          <div className="field">
            <label htmlFor="m-title">Titolo</label>
            <input id="m-title" name="title" placeholder="Comitato studentesco" required />
          </div>

          <div className="field">
            <label htmlFor="m-date">Data e ora</label>
            <input id="m-date" name="startsAt" type="datetime-local" required />
          </div>

          <div className="row modal-actions">
            <button>Crea seduta</button>
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Annulla
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === "poll"}
        title="Nuova votazione"
        description="Definisci modalità, riservatezza e opzioni di voto."
        onClose={() => setModal(null)}
      >
        <form className="stack" onSubmit={createPoll}>
          <div className="field">
            <label htmlFor="p-title">Titolo</label>
            <input id="p-title" name="title" placeholder="Titolo della votazione" required />
          </div>

          <div className="field">
            <label htmlFor="p-desc">Descrizione</label>
            <textarea
              id="p-desc"
              name="description"
              placeholder="Una breve descrizione o il testo della proposta..."
            />
          </div>

          <div className="grid">
            <div className="field">
              <label htmlFor="p-mode">Modalità</label>
              <select id="p-mode" name="mode" defaultValue="ASYNC">
                <option value="ASYNC">Asincrono</option>
                <option value="IN_PERSON">In presenza</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="p-vis">Tipo di voto</label>
              <select id="p-vis" name="visibility" defaultValue="NAMED">
                <option value="NAMED">Palese</option>
                <option value="SECRET">Segreto</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="p-status">Stato iniziale</label>
              <select id="p-status" name="status" defaultValue="DRAFT">
                <option value="DRAFT">Bozza</option>
                <option value="OPEN">Aperta</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="p-meeting">Seduta collegata</label>
            <select id="p-meeting" name="meetingId" defaultValue="">
              <option value="">Nessuna (necessaria solo per il voto in presenza)</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="p-options">Opzioni (una per riga)</label>
            <textarea
              id="p-options"
              name="options"
              placeholder={"Favorevole\nContrario\nAstenuto"}
              required
            />
          </div>

          <div className="row modal-actions">
            <button>Crea votazione</button>
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Annulla
            </button>
            <span className="meta">Puoi lasciarla in bozza e aprirla dopo.</span>
          </div>
        </form>
      </Modal>
    </>
  );
}
