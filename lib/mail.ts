import nodemailer from "nodemailer";

/*
  Invio email via SMTP con template HTML istituzionale e fallback in testo semplice.
  Si configura con variabili d'ambiente:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e MAIL_FROM.
*/

export function mailEnabled() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM
  );
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailTemplateOptions = {
  badge?: string;
  title: string;
  greeting?: string;
  paragraphs?: string[];
  bodyLines?: string[];
  codeBox?: { label: string; code: string };
  highlightCode?: string;
  action?: { label: string; url: string };
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

/**
 * Costruisce un'email HTML istituzionale compatibile con tutti i client di posta.
 */
export function buildHtmlEmail(opts: EmailTemplateOptions): string {
  const lines = opts.paragraphs ?? opts.bodyLines ?? [];
  const paragraphsHtml = lines
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#33445f;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`
    )
    .join("");

  const resolvedCodeBox =
    opts.codeBox ??
    (opts.highlightCode
      ? { label: opts.badge ?? "Codice", code: opts.highlightCode }
      : undefined);

  const codeHtml = resolvedCodeBox
    ? `<div style="margin:22px 0;padding:18px 20px;border-radius:12px;background:#f2f7fe;border:1px solid #bfd3f6;text-align:center;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1244c7;margin-bottom:6px;">
          ${escapeHtml(resolvedCodeBox.label)}
        </div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.22em;color:#091930;">
          ${escapeHtml(resolvedCodeBox.code)}
        </div>
      </div>`
    : "";

  const resolvedAction =
    opts.action ??
    (opts.ctaLabel && opts.ctaUrl
      ? { label: opts.ctaLabel, url: opts.ctaUrl }
      : undefined);

  const actionHtml = resolvedAction
    ? `<div style="margin:24px 0 20px;text-align:center;">
        <a href="${escapeHtml(resolvedAction.url)}" style="display:inline-block;padding:13px 26px;border-radius:10px;background:#1a5cff;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">
          ${escapeHtml(resolvedAction.label)}
        </a>
      </div>
      <p style="margin:0 0 14px;color:#74859f;font-size:12px;line-height:1.5;word-break:break-all;">
        Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:<br/>
        <a href="${escapeHtml(resolvedAction.url)}" style="color:#1244c7;">${escapeHtml(resolvedAction.url)}</a>
      </p>`
    : "";

  const badgeHtml = opts.badge
    ? `<div style="display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:999px;background:#eaf2ff;color:#1244c7;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
        ${escapeHtml(opts.badge)}
      </div>`
    : "";

  const footerHtml = opts.footerNote
    ? `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #dbe3ef;color:#74859f;font-size:13px;line-height:1.5;">
        ${escapeHtml(opts.footerNote)}
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:28px 14px;background:#eef2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#091930;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;">
    <tr>
      <td>
        <div style="background:#091930;color:#ffffff;padding:20px 24px;border-radius:16px 16px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="44" valign="middle">
                <div style="width:36px;height:36px;line-height:36px;text-align:center;border-radius:9px;background:#1a5cff;color:#ffffff;font-family:Georgia,serif;font-size:18px;font-weight:bold;">
                  CS
                </div>
              </td>
              <td valign="middle">
                <div style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">Comitato Studentesco</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.62);">Portale delle Assemblee e Votazioni</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#ffffff;padding:28px 26px;border:1px solid #dbe3ef;border-top:0;border-radius:0 0 16px 16px;">
          ${badgeHtml}
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;color:#091930;line-height:1.15;">
            ${escapeHtml(opts.title)}
          </h1>
          ${opts.greeting ? `<p style="margin:0 0 12px;color:#091930;font-size:15px;font-weight:600;">${escapeHtml(opts.greeting)}</p>` : ""}
          ${paragraphsHtml}
          ${codeHtml}
          ${actionHtml}
          ${footerHtml}
        </div>
        <div style="text-align:center;padding:14px 10px 0;color:#74859f;font-size:12px;">
          Messaggio automatico dal portale del Comitato Studentesco.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  template?: EmailTemplateOptions
) {
  if (!mailEnabled()) throw new Error("MAIL_DISABLED");

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  const html = template ? buildHtmlEmail(template) : undefined;

  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  });
}

/** Indirizzo pubblico del sito, usato nei link delle email. Mai ricavato dalla richiesta. */
export function appUrl() {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return "https://" + vercel;
  return "http://localhost:3000";
}
