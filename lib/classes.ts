/**
 * Confronta i nomi delle classi ignorando maiuscole, spazi e punteggiatura:
 * "3BES", "3B ES" e "3b es" indicano la stessa classe.
 */
export function normalizeClass(name: string) {
  return name.replace(/[\s._-]+/g, "").toUpperCase();
}
