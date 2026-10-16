"use client";

import { FormEvent, useMemo, useState } from "react";
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

function currentRomeDateTimeLocal() {
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
    return parts.replace(" ", "T");
  } catch {
    return "";
  }
}

const OPTION_PRESETS = [
  { label: "Favorevole / Contrario / Astenuto", value: "Favorevole\nContrario\nAstenuto" },
  { label: "Sì / No / Astenuto", value: "Sì\nNo\nAstenuto" },
  { label: "Favorevole / Contrario", value: "Favorevole\nContrario" }
];

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
  const [pollFilter, setPollFilter] = useState<"ALL" | "OPEN" | "DRAFT" | "CLOSED">("ALL");

  // Stato controllato per il form Nuova Votazione (preset opzioni e vincoli seduta/presenti)
  const [pollMode, setPollMode] = useState<"ASYNC" | "IN_PERSON">("ASYNC");
  const [pollMeetingId, setPollMeetingId] = useState<string>("");
  const [quorumBase, setQuorumBase] = useState<"MEMBERS" | "PRESENT">("MEMBERS");
  const [majority, setMajority] = useState<"EXPRESSED" | "PRESENT" | "MEMBERS">("EXPRESSED");
  const [optionsText, setOptionsText] = useState("Favorevole\nContrario\nAstenuto");

  // Stato data/ora per Nuova Seduta
  const [meetingStartsAt, setMeetingStartsAt] = useState("");

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

  function openNewMeetingModal() {
    setMeetingStartsAt(currentRomeDateTimeLocal());
    setModal("meeting");
  }

  function openNewPollModal() {
    const defaultMeeting = meetings[0]?.id ?? "";
    setPollMode(defaultMeeting ? "IN_PERSON" : "ASYNC");
    setPollMeetingId(defaultMeeting);
    setQuorumBase(defaultMeeting ? "PRESENT" : "MEMBERS");
    setMajority("EXPRESSED");
    setOptionsText("Favorevole\nContrario\nAstenuto");
    setModal("poll");
  }

  function handleModeChange(nextMode: "ASYNC" | "IN_PERSON") {
    setPollMode(nextMode);
    if (nextMode === "IN_PERSON" && !pollMeetingId && meetings[0]) {
      setPollMeetingId(meetings[0].id);
    }
  }

  function handleMeetingChange(nextMeetingId: string) {
    setPollMeetingId(nextMeetingId);
    if (!nextMeetingId) {
      if (quorumBase === "PRESENT") setQuorumBase("MEMBERS");
      if (majority === "PRESENT") setMajority("EXPRESSED");
    }
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

    notify("Seduta creata correttamente.");
    setModal(null);
    formEl.reset();
    router.refresh();
  }

  async function createPoll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    if (pollMode === "IN_PERSON" && !pollMeetingId) {
      notify("Per una votazione in presenza devi selezionare una seduta aperta.", "error");
      return;
    }

    const options = optionsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const body = {
      title: form.get("title"),
      description: form.get("description"),
      mode: pollMode,
      visibility: form.get("visibility"),
      status: form.get("status"),
      meetingId: pollMeetingId || null,
      quorumPercent: Number(form.get("quorumPercent") || 0),
      quorumBase: pollMeetingId ? quorumBase : "MEMBERS",
      majority: !pollMeetingId && majority === "PRESENT" ? "EXPRESSED" : majority,
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

    notify("Votazione creata correttamente.");
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

    notify(status === "OPEN" ? "Votazione aperta al voto." : "Votazione chiusa.");
    router.refresh();
  }

  function closeMeeting(meeting: Meeting) {
    setPending({
      title: "Archiviare la seduta?",
      message: "«" + meeting.title + "» verrà chiusa e resterà consultabile nell'Archivio.",
      label: "Archivia seduta",
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

  const filteredPolls = useMemo(() => {
    if (pollFilter === "ALL") return polls;
    return polls.filter((p) => p.status === pollFilter);
  }, [polls, pollFilter]);

  const counts = useMemo(
    () => ({
      ALL: polls.length,
      OPEN: polls.filter((p) => p.status === "OPEN").length,
      DRAFT: polls.filter((p) => p.status === "DRAFT").length,
      CLOSED: polls.filter((p) => p.status === "CLOSED").length
    }),
    [polls]
  );

  const hiddenClosed = closedTotal - counts.CLOSED;

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
          <Icon name={messageType === "success" ? "check" : "alert"} size={18} />
          <span>{message}</span>
        </div>
      )}

      <div className="split">
        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">
                <Icon name="vote" size={20} /> Votazioni
              </h2>
              <p className="section-note">Gestisci stato, risultati in tempo reale e modalità proiezione.</p>
            </div>
            <button onClick={openNewPollModal}>
              <Icon name="plus" size={18} /> Nuova votazione
            </button>
          </div>

          {polls.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-inner">
                <div className="empty-icon" aria-hidden="true">
                  <Icon name="vote" size={26} />
                </div>
                <strong>Nessuna votazione creata</strong>
                <p className="muted" style={{ margin: "4px 0 14px" }}>
                  Crea una nuova scheda di voto in presenza o asincrona per iniziare.
                </p>
                <button type="button" onClick={openNewPollModal}>
                  <Icon name="plus" size={17} /> Crea la prima votazione
                </button>
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              <div className="toolbar">
                <div className="segmented" role="group" aria-label="Filtra votazioni per stato">
                  {(
                    [
                      ["ALL", "Tutte", counts.ALL],
                      ["OPEN", "Aperte", counts.OPEN],
                      ["DRAFT", "Bozze", counts.DRAFT],
                      ["CLOSED", "Chiuse", counts.CLOSED]
                    ] as const
                  ).map(([val, label, count]) => (
                    <button
                      key={val}
                      type="button"
                      className={pollFilter === val ? "active" : ""}
                      onClick={() => setPollFilter(val)}
                    >
                      {label}
                      <span className="count">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {filteredPolls.map((poll) => (
                <div className={"item" + (poll.status === "OPEN" ? " item-highlight" : "")} key={poll.id}>
                  <div className="item-main">
                    <Link href={"/admin/polls/" + poll.id} className="item-title item-title-link">
                      {poll.title}
                    </Link>
                    <div className="item-meta">
                      <span className={"badge " + statusClass(poll.status)}>
                        {poll.status === "OPEN" && <span className="pulse-dot green" aria-hidden="true" />}
                        {statusLabel(poll.status)}
                      </span>
                      <span className="badge gray">
                        {poll.mode === "IN_PERSON" ? "In presenza" : "Asincrono"}
                      </span>
                      <span className="badge gray">
                        <Icon name={poll.visibility === "SECRET" ? "lock" : "eye"} size={12} />
                        {poll.visibility === "SECRET" ? "Segreto" : "Palese"}
                      </span>
                    </div>
                  </div>

                  <div className="item-actions">
                    <Link className="button secondary small" href={"/admin/polls/" + poll.id}>
                      Risultati
                    </Link>

                    {poll.status !== "OPEN" && (
                      <button
                        className="small"
                        disabled={busyId === poll.id}
                        onClick={() => changeStatus(poll.id, "OPEN")}
                      >
                        Apri
                      </button>
                    )}

                    {poll.status === "OPEN" && (
                      <button
                        className="secondary small"
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

              {filteredPolls.length === 0 && (
                <div className="item">
                  <span className="muted">Nessuna votazione in questo stato.</span>
                </div>
              )}

              {hiddenClosed > 0 && (
                <div className="list-foot">
                  Mostrate solo le ultime chiuse: altre {hiddenClosed} sono consultabili nell&apos;
                  <Link href="/archivio">Archivio completo</Link>.
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">
                <Icon name="calendar" size={20} /> Sedute aperte
              </h2>
              <p className="section-note">Appello e presenze dei rappresentanti.</p>
            </div>
            <button className="secondary" onClick={openNewMeetingModal}>
              <Icon name="plus" size={18} /> Nuova seduta
            </button>
          </div>

          {meetings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-inner">
                <div className="empty-icon" aria-hidden="true">
                  <Icon name="calendar" size={26} />
                </div>
                <strong>Nessuna seduta aperta</strong>
                <p className="muted" style={{ margin: "4px 0 14px" }}>
                  Crea una seduta per registrare le presenze in aula e abilitare il voto in presenza.
                </p>
                <button type="button" className="secondary" onClick={openNewMeetingModal}>
                  <Icon name="plus" size={17} /> Crea seduta
                </button>
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {meetings.map((meeting) => (
                <div className="item" key={meeting.id}>
                  <div className="item-main">
                    <Link href={"/admin/meetings/" + meeting.id} className="item-title item-title-link">
                      {meeting.title}
                    </Link>
                    <div className="item-sub">
                      <Icon name="clock" size={13} /> {formatDateTime(meeting.startsAt)}
                    </div>
                  </div>

                  <div className="item-actions">
                    <Link className="button secondary small" href={"/admin/meetings/" + meeting.id}>
                      Appello presenze
                    </Link>
                    <RowMenu
                      label={"Altre azioni per " + meeting.title}
                      items={[
                        {
                          label: "Archivia seduta",
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
        description="Imposta il titolo dell'assemblea, la data e l'orario di inizio."
        onClose={() => setModal(null)}
      >
        <form className="stack" onSubmit={createMeeting}>
          <div className="field">
            <label htmlFor="m-title">Titolo della seduta</label>
            <input
              id="m-title"
              name="title"
              placeholder="Es. Assemblea ordinaria d'Ottobre"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="m-date">Data e ora di convocazione</label>
            <input
              id="m-date"
              name="startsAt"
              type="datetime-local"
              value={meetingStartsAt}
              onChange={(e) => setMeetingStartsAt(e.target.value)}
              required
            />
            <p className="hint">Fuso orario applicato: Europe/Rome.</p>
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
        description="Definisci quesito, modalità di partecipazione, quorum e opzioni di voto."
        onClose={() => setModal(null)}
      >
        <form className="stack" onSubmit={createPoll}>
          <div className="field">
            <label htmlFor="p-title">Titolo o quesito della votazione</label>
            <input
              id="p-title"
              name="title"
              placeholder="Es. Approvazione mozione calendario scolastico"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="p-desc">Descrizione o testo della proposta (facoltativo)</label>
            <textarea
              id="p-desc"
              name="description"
              placeholder="Aggiungi eventuali dettagli o il testo sintetico della proposta..."
              style={{ minHeight: 80 }}
            />
          </div>

          <div className="grid">
            <div className="field">
              <label htmlFor="p-mode">Modalità</label>
              <select
                id="p-mode"
                name="mode"
                value={pollMode}
                onChange={(e) => handleModeChange(e.target.value as "ASYNC" | "IN_PERSON")}
              >
                <option value="IN_PERSON">In presenza (solo presenti)</option>
                <option value="ASYNC">Asincrono (tutti gli attivi)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="p-vis">Scrutinio</label>
              <select id="p-vis" name="visibility" defaultValue="NAMED">
                <option value="NAMED">Palese (nominativo)</option>
                <option value="SECRET">Segreto (anonimizzato)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="p-status">Stato iniziale</label>
              <select id="p-status" name="status" defaultValue="DRAFT">
                <option value="DRAFT">Salva in bozza</option>
                <option value="OPEN">Apri subito al voto</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="p-meeting">
              Seduta collegata {pollMode === "IN_PERSON" ? "(richiesta)" : "(facoltativa)"}
            </label>
            <select
              id="p-meeting"
              name="meetingId"
              value={pollMeetingId}
              onChange={(e) => handleMeetingChange(e.target.value)}
              required={pollMode === "IN_PERSON"}
            >
              <option value="">
                {pollMode === "IN_PERSON"
                  ? "— Seleziona una seduta aperta —"
                  : "Nessuna seduta collegata"}
              </option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title} ({formatDateTime(meeting.startsAt)})
                </option>
              ))}
            </select>
            {pollMode === "IN_PERSON" && meetings.length === 0 && (
              <p className="error" style={{ margin: 0 }}>
                Non ci sono sedute aperte. Crea prima una seduta oppure scegli la modalità «Asincrono».
              </p>
            )}
          </div>

          <div className="grid">
            <div className="field">
              <label htmlFor="p-quorum">Quorum (%)</label>
              <input
                id="p-quorum"
                name="quorumPercent"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                defaultValue={50}
                required
              />
              <p className="hint">Percentuale minima di votanti (0 = nessun quorum).</p>
            </div>

            <div className="field">
              <label htmlFor="p-qbase">Base del quorum</label>
              <select
                id="p-qbase"
                name="quorumBase"
                value={quorumBase}
                onChange={(e) => setQuorumBase(e.target.value as "MEMBERS" | "PRESENT")}
              >
                <option value="MEMBERS">Membri totali attivi</option>
                <option value="PRESENT" disabled={!pollMeetingId}>
                  Presenti alla seduta{!pollMeetingId ? " (collega una seduta)" : ""}
                </option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="p-majority">Maggioranza richiesta per approvare</label>
            <select
              id="p-majority"
              name="majority"
              value={majority}
              onChange={(e) => setMajority(e.target.value as "EXPRESSED" | "PRESENT" | "MEMBERS")}
            >
              <option value="EXPRESSED">Semplice: più favorevoli che contrari tra i voti espressi</option>
              <option value="PRESENT" disabled={!pollMeetingId}>
                Assoluta sui presenti: più della metà dei presenti alla seduta
              </option>
              <option value="MEMBERS">
                Assoluta sui membri: più della metà di tutti gli aventi diritto
              </option>
            </select>
          </div>

          <div className="field">
            <div className="label-row">
              <label htmlFor="p-options">Opzioni di voto (una per riga)</label>
              <div className="preset-pills">
                {OPTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-pill"
                    onClick={() => setOptionsText(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="p-options"
              name="options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"Favorevole\nContrario\nAstenuto"}
              required
            />
          </div>

          <div className="row modal-actions">
            <button disabled={pollMode === "IN_PERSON" && !pollMeetingId}>Crea votazione</button>
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Annulla
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
