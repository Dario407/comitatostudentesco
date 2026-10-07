import Link from "next/link";
import { verifyPurposeToken } from "@/lib/auth";
import AuthLayout from "@/components/AuthLayout";
import ResetForm from "@/components/ResetForm";

export default async function ResetCodePage({
  searchParams
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "" } = await searchParams;
  const valid = t ? await verifyPurposeToken("reset", t) : null;

  return (
    <AuthLayout headline="Un codice nuovo, tutto tuo." text="Scegli un codice che ricordi solo tu e non condividerlo con nessuno.">
      <h2>Nuovo codice</h2>
      {valid ? (
        <>
          <p className="muted">Scegli il nuovo codice di accesso.</p>
          <ResetForm token={t} />
        </>
      ) : (
        <>
          <div className="error-box">Il link non è valido o è scaduto.</div>
          <p className="meta login-note"><Link href="/recupero">Richiedine uno nuovo</Link></p>
        </>
      )}
    </AuthLayout>
  );
}
