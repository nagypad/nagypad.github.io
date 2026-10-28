#!/usr/bin/env node
/**
 * Naponta egyszer fut (GitHub Actions cron, lásd .github/workflows/deploy.yml),
 * és frissíti a `src/data/napi-pad.json` naplót: kisorsolja a mai "nap padját"
 * a teljes, koordinátával rendelkező padlistából, úgy, hogy egy teljes kör
 * (az összes pad) vége előtt ne ismétlődjön.
 *
 * A módosított naplót a workflow commitolja — ettől kezdve mindenki (a
 * címlap, az RSS, a Facebook-poszt) ugyanazt a padot látja aznap.
 *
 * Idempotens: ha a mai napra már van bejegyzés, nem sorsol újra (akkor sem,
 * ha a workflow egy napon belül többször fut).
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { olvassFrontmattert } from "./lib/frontmatter.mjs";

const gyokerDir = fileURLToPath(new URL("..", import.meta.url));
const padokDir = join(gyokerDir, "src/content/padok");
const naploPath = join(gyokerDir, "src/data/napi-pad.json");

function maiNap() {
  return new Date().toISOString().slice(0, 10);
}

function koordinaltSlugek() {
  const slugek = [];
  for (const nev of readdirSync(padokDir, { withFileTypes: true })) {
    if (!nev.isDirectory()) continue;
    const indexPath = join(padokDir, nev.name, "index.md");
    if (!existsSync(indexPath)) continue;
    const adat = olvassFrontmattert(indexPath);
    if (Array.isArray(adat.coords) && adat.coords.length === 2) {
      slugek.push(nev.name);
    }
  }
  return slugek.sort();
}

function naploBetoltese() {
  if (!existsSync(naploPath)) return { mutatott: [] };
  try {
    const nyers = JSON.parse(readFileSync(naploPath, "utf-8"));
    return {
      mai: nyers.mai,
      mutatott: Array.isArray(nyers.mutatott) ? nyers.mutatott : [],
    };
  } catch {
    return { mutatott: [] };
  }
}

function main() {
  const eselyesek = koordinaltSlugek();
  if (eselyesek.length === 0) {
    console.error("Nincs koordinátával rendelkező pad — nincs mit sorsolni.");
    process.exit(1);
  }

  const napi = maiNap();
  const naplo = naploBetoltese();

  if (naplo.mai?.nap === napi && eselyesek.includes(naplo.mai.slug)) {
    console.log(
      `A mai nap padja már ki van sorsolva: ${naplo.mai.slug} (nincs teendő).`,
    );
    return;
  }

  let mutatott = naplo.mutatott.filter((slug) => eselyesek.includes(slug));
  let jeloltek = eselyesek.filter((slug) => !mutatott.includes(slug));

  if (jeloltek.length === 0) {
    // Egy teljes kör lement — új kör indul, minden pad újra jelölt lehet.
    mutatott = [];
    jeloltek = eselyesek;
  }

  const kivalasztott = jeloltek[Math.floor(Math.random() * jeloltek.length)];
  mutatott.push(kivalasztott);

  const ujNaplo = {
    mai: { nap: napi, slug: kivalasztott },
    mutatott,
  };

  writeFileSync(naploPath, JSON.stringify(ujNaplo, null, 2) + "\n", "utf-8");
  console.log(
    `A nap padja (${napi}): ${kivalasztott}  (${mutatott.length}/${eselyesek.length} ment a jelenlegi körben)`,
  );
}

main();
