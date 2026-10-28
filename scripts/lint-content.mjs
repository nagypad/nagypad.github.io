#!/usr/bin/env node
/**
 * Könnyű tartalom-ellenőrzés a Zod-sémán túl (ami a `build` lépésben már
 * lefut). Két mód:
 *   --strict  : PR-eknél fut (ellenorzes.yml) — hibára kilép (exit 1).
 *   (alap)    : heti health-check-nél fut (kephigienia.yml) — csak jelez.
 *
 * Amit néz:
 *  - minden `photos[].src` fájl valóban létezik-e
 *  - nincs-e kirívóan nagy (>8 MB) kép a padok mellett (jele, hogy
 *    valami nem lett újrakódolva/összenyomva beküldésnél)
 *  - mely címkék szerepelnek csak egyetlen padon (tipikus elírás-gyanú,
 *    lásd TERV.md 9. fejezet) — csak figyelmeztetés, soha nem hiba
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const strict = process.argv.includes("--strict");
const padokDir = new URL("../src/content/padok", import.meta.url).pathname;

const MAX_KEP_BYTE = 8 * 1024 * 1024;

let hiba = 0;
const tagSzamlalo = new Map();

for (const nev of readdirSync(padokDir, { withFileTypes: true })) {
  if (!nev.isDirectory()) continue;
  const padDir = join(padokDir, nev.name);
  const indexPath = join(padDir, "index.md");
  if (!existsSync(indexPath)) {
    console.error(`HIBA: ${nev.name}/ nincs index.md`);
    hiba++;
    continue;
  }

  const nyers = readFileSync(indexPath, "utf-8");
  const match = nyers.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = match ? yaml.load(match[1]) : {};

  for (const foto of fm.photos ?? []) {
    const kepUtvonal = join(padDir, foto.src);
    if (!existsSync(kepUtvonal)) {
      console.error(`HIBA: ${nev.name}: hiányzó fotó (${foto.src})`);
      hiba++;
      continue;
    }
    const meret = statSync(kepUtvonal).size;
    if (meret > MAX_KEP_BYTE) {
      console.error(
        `HIBA: ${nev.name}: túl nagy fotó (${foto.src}, ${Math.round(meret / 1024)} kB)`,
      );
      hiba++;
    }
  }

  for (const tag of fm.tags ?? []) {
    tagSzamlalo.set(tag, (tagSzamlalo.get(tag) ?? 0) + 1);
  }
}

const egyszerHasznaltak = [...tagSzamlalo.entries()]
  .filter(([, db]) => db === 1)
  .map(([t]) => t);
if (egyszerHasznaltak.length > 0) {
  console.warn(
    `FIGYELEM: ${egyszerHasznaltak.length} címke csak 1 padon szerepel (elírás-gyanú): ${egyszerHasznaltak.join(", ")}`,
  );
}

if (hiba > 0) {
  console.error(`\n${hiba} hiba.`);
  if (strict) process.exit(1);
} else {
  console.log("Nincs hiba.");
}
