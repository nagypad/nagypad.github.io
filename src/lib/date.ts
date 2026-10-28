const HONAPOK = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
] as const;

/**
 * "2015. január" formátum — szándékosan SOHA nem ír ki napot.
 *
 * A régi posztoknál csak év-hónap ismert a blog URL-jéből (nincs
 * `datePrecision` mező, a mezőt a terv egyszerűsítette), ezért a honlap
 * mindenhol egységesen hónap-pontossággal jelenít meg minden dátumot —
 * így a régi és az új padok között nincs kitalált nap, és nincs
 * következetlenség a megjelenítésben.
 */
export function formatHonap(date: Date): string {
  return `${date.getUTCFullYear()}. ${HONAPOK[date.getUTCMonth()]}`;
}

/** RSS-hez és a sitemaphoz: ISO 8601 dátum, időzóna nélkül (UTC éjfél). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
