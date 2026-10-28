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
 * "2015. január 3." formátum — mindenhol napra pontosan írjuk ki a dátumot.
 *
 * A régi posztoknál csak év-hónap ismert a blog URL-jéből, ezért ott a
 * frontmatter dátuma a hónap elseje, és így is jelenik meg.
 */
export function formatDatum(date: Date): string {
  return `${date.getUTCFullYear()}. ${HONAPOK[date.getUTCMonth()]} ${date.getUTCDate()}.`;
}

/** RSS-hez és a sitemaphoz: ISO 8601 dátum, időzóna nélkül (UTC éjfél). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
