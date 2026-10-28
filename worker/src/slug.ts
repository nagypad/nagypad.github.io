/**
 * Ugyanaz a transzliterációs logika, mint a `src/lib/tags.ts`-ben és a
 * `scripts/lib/slug.mjs`-ben — három helyen, három különböző futási
 * környezetben (böngésző-build, Node szkript, Cloudflare Worker), ezért
 * nincs egyszerű módja megosztani egy közös csomag nélkül. Egy ilyen kis,
 * stabil függvénynél a duplikáció olcsóbb, mint egy monorepo-csomag.
 */
const HU_TRANSLIT: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ö: "o",
  ő: "o",
  ú: "u",
  ü: "u",
  ű: "u",
};

export function slugify(szoveg: string): string {
  return szoveg
    .toLowerCase()
    .replace(/[áéíóöőúüű]/g, (ch) => HU_TRANSLIT[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
