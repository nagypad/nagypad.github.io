import yaml from "js-yaml";
// `?raw` import: Vite statikusan bundle-eli a fájlt (ellentétben egy
// `fs.readFileSync`-kel), így a build-time "prerender" lépésben is elérhető.
import aliasokYaml from "../data/cimke-aliasok.yml?raw";

const aliasok = yaml.load(aliasokYaml) as Record<string, string>;

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

/**
 * Elírás/szinonima összevonása a kanonikus névre (`cimke-aliasok.yml` alapján).
 * Az összevonás kis- és nagybetű-érzéketlen; a megjelenített alak mindig a
 * szótárban megadott kanonikus írásmód.
 */
export function kanonikusCimke(cimke: string): string {
  const kulcs = cimke.trim().toLowerCase();
  return aliasok[kulcs] ?? cimke.trim();
}

/**
 * URL-barát slug egy címkéhez: kisbetű, magyar ékezetek átírva, szóköz → kötőjel.
 * A megjelenített név (a kanonikus alak, ékezetekkel) marad a UI-ban — ez csak
 * a `/cimke/<slug>/` útvonalhoz kell.
 */
export function cimkeSlug(cimke: string): string {
  return kanonikusCimke(cimke)
    .toLowerCase()
    .replace(/[áéíóöőúüű]/g, (ch) => HU_TRANSLIT[ch] ?? ch)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Egy pad összes címkéjét kanonizálja, duplikátum-szűréssel. */
export function kanonikusCimkek(cimkek: string[]): string[] {
  const latott = new Set<string>();
  const eredmeny: string[] = [];
  for (const c of cimkek) {
    const kanonikus = kanonikusCimke(c);
    if (!latott.has(kanonikus)) {
      latott.add(kanonikus);
      eredmeny.push(kanonikus);
    }
  }
  return eredmeny;
}
