import nodemailer from "nodemailer";

/*
  Invio email via SMTP. Si configura con variabili d'ambiente (vedi README):
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e MAIL_FROM.
  Con un account Gmail basta una "password per le app" (host smtp.gmail.com, porta 465).
  Se non è configurato, le funzioni che usano l'email restano spente senza dare errori.
*/

export function mailEnabled() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM
  );
}

export async function sendMail(to: string, subject: string, text: string) {
  if (!mailEnabled()) throw new Error("MAIL_DISABLED");

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}

/** Indirizzo pubblico del sito, usato nei link delle email. Mai ricavato dalla richiesta. */
export function appUrl() {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return "https://" + vercel;
  return "http://localhost:3000";
}
