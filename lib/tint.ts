// Come sulle schede dei referendum, ogni votazione ha il proprio colore di carta.
// Il colore dipende dall'id, quindi resta lo stesso ovunque compaia la votazione.
export const TINT_COUNT = 6;

export function tintIndex(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % TINT_COUNT;
}
