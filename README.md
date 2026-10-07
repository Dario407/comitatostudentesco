# Comitato Studentesco

MVP per gestire presenze e votazioni del Comitato Studentesco con meno di 200 utenti.

## Funzioni presenti

- Login con numero di telefono + codice di accesso.
- Il numero di telefono non viene salvato in chiaro: nel database viene conservato un HMAC usato per il lookup.
- Ruoli: rappresentante di classe e rappresentante d'istituto. I rappresentanti d'istituto gestiscono utenti, sedute, presenze e votazioni.
- Sedute del Comitato e registrazione presenze.
- Voto in presenza: può votare soltanto chi risulta presente alla seduta collegata.
- Voto asincrono.
- Voto palese: i rappresentanti d'istituto possono vedere chi ha votato e cosa.
- Voto segreto: partecipazione e scheda sono separate, quindi l'applicazione non conserva un collegamento tra persona e scelta.
- Vincoli database contro il doppio voto.
- Audit log delle operazioni amministrative principali.
- Dashboard con risultati e lista di chi non ha ancora votato.

## Stack

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Vercel

Per il database è adatto un PostgreSQL serverless come Neon, ma il progetto non dipende da uno specifico provider.

## Setup

1. Copia le variabili d'ambiente:

```bash
cp .env.example .env
```

2. Imposta:

- `DATABASE_URL`
- `SESSION_SECRET` - almeno 32 caratteri casuali
- `PHONE_LOOKUP_SECRET` - segreto diverso dal precedente

3. Installa e crea lo schema:

```bash
npm install
npm run db:push
```

4. Importa gli utenti:

```bash
cp members.example.csv members.csv
# modifica members.csv
npm run import:members -- members.csv
```

5. Avvia:

```bash
npm run dev
```

## CSV utenti

Separatore: punto e virgola.

```text
first_name;last_name;class_name;phone;role;access_code
Mario;Rossi;3BES;+393331234567;CLASS_REP;A7B9C2D4
```

Ruoli ammessi:

- `CLASS_REP`
- `INSTITUTE_REP`

Se `access_code` è vuoto, lo script ne genera uno e lo stampa una sola volta.

## Regole del voto

### In presenza

Il backend controlla:

1. utente autenticato e attivo;
2. votazione aperta;
3. presenza registrata per la seduta;
4. opzione appartenente alla votazione;
5. assenza di un voto precedente.

### Asincrono

Il controllo della presenza viene omesso, ma restano gli altri controlli.

### Voto segreto

Per il voto segreto:

- `SecretParticipation` conserva chi ha partecipato;
- `SecretBallot` conserva l'opzione votata;
- non esiste una foreign key tra persona e scheda;
- la scheda segreta non contiene un timestamp e ha un id casuale, non ordinabile nel tempo;
- la partecipazione registra solo il giorno del voto, non l'ora, e per i voti segreti non viene scritta una riga di audit;
- alla chiusura della votazione le schede vengono riscritte in ordine casuale, così l'ordine fisico delle righe non coincide con l'ordine di voto.

Per i voti segreti registrati prima di questa modifica esegui una volta `npm run anonymize:secret` (serve `DATABASE_URL`).

Resta un limite: chi ha accesso diretto al database durante una votazione ancora aperta, con pochissimi voti, potrebbe ricostruire l'ordine di inserimento. La protezione riguarda i risultati a votazione chiusa.

## Accesso e sessioni

- I tentativi falliti sono contati nel registro (`AuditLog`), quindi il limite vale su tutte le istanze di Vercel: 5 tentativi per coppia numero+IP, 12 per numero, 30 per IP, in 15 minuti.
- "Esci" revoca la sessione lato server. Rigenerare il codice di accesso di un utente chiude subito le sue sessioni aperte.
- Le date e gli orari sono sempre in fuso `Europe/Rome`, sia in scrittura sia in lettura.

## Privacy e sicurezza

Questa è una base tecnica, non sostituisce le decisioni della scuola sul trattamento dei dati.

Prima dell'uso reale vanno definiti:

- titolare e finalità del trattamento;
- tempi di conservazione;
- votazioni palesi e votazioni segrete;
- persone abilitate all'amministrazione;
- procedura di cancellazione;
- informativa agli interessati;
- confronto con scuola e RPD/DPO.

Il database non salva il numero di telefono in chiaro, ma nome, cognome, classe, presenze e partecipazione alle votazioni restano dati personali.

## Deploy su Vercel

1. Crea o collega un database PostgreSQL.
2. Inserisci `DATABASE_URL`, `SESSION_SECRET` e `PHONE_LOOKUP_SECRET` nelle Environment Variables.
3. Esegui `npm run db:push` sul database.
4. Importa gli utenti.
5. Collega questa repository a Vercel.

## Prima della produzione

Da aggiungere prima dell'uso reale:

- eventuali passkey;
- esportazione del verbale dei risultati;
- test automatici;
- policy di retention e cancellazione dati.
