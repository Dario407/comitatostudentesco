/**
 * Come fetch, ma non lancia mai: se la rete è assente o il server non risponde restituisce
 * una Response 503 con un messaggio leggibile. In questo modo i pulsanti non restano bloccati
 * su "in corso..." e l'errore compare dove compaiono tutti gli altri.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(
      JSON.stringify({
        error: "Connessione assente o server non raggiungibile. Controlla la rete e riprova."
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
}
