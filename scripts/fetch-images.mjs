#!/usr/bin/env node
/**
 * M1 — a legsürgősebb lépés: a régi blogspot-képek letöltése, amíg élnek
 * (lásd TERV.md 2. és 14. fejezet). Minden sorhoz összegyűjti a fotók
 * URL-jeit (az `img` mező + a `description` HTML-ben talált további
 * <img>-ek, a megjelenés sorrendjében, duplikátum-szűréssel), letölti őket,
 * és egy manifestbe írja, hogy melyik sorhoz melyik helyi fájl tartozik.
 *
 * Újrafuttatható: a már letöltött (és a manifestben szereplő) képeket nem
 * tölti le újra.
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { olvassPostsExport } from "./lib/posts-tsv.mjs";

const gyokerDir = new URL("..", import.meta.url).pathname;
const exportPath = join(gyokerDir, "archive/posts-export.txt");
const kimenetDir = join(gyokerDir, "archive/original");
const manifestPath = join(gyokerDir, "archive/images-manifest.json");

const PARHUZAMOSSAG = 6;
const PROBALKOZASOK = 3;
const IDOTULLEPES_MS = 25_000;

function kepUrlekSorbol(sor) {
  const urlek = [];
  if (sor.img && sor.img.trim()) urlek.push(sor.img.trim());

  const $ = cheerio.load(sor.description ?? "");
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !urlek.includes(src)) urlek.push(src);
  });

  return urlek;
}

function kiterjesztes(url) {
  const match = url.match(/\.(jpe?g|png|gif|webp)(?:$|[?#])/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

async function letoltEgyszer(url) {
  const valasz = await fetch(url, {
    signal: AbortSignal.timeout(IDOTULLEPES_MS),
    headers: { "User-Agent": "nagypad-projekt-archivalo/1.0" },
  });
  if (!valasz.ok) throw new Error(`HTTP ${valasz.status}`);
  return Buffer.from(await valasz.arrayBuffer());
}

async function letoltes(url) {
  let utolsoHiba;
  for (let kiserlet = 1; kiserlet <= PROBALKOZASOK; kiserlet++) {
    try {
      return await letoltEgyszer(url);
    } catch (hiba) {
      utolsoHiba = hiba;
      if (kiserlet < PROBALKOZASOK) {
        await new Promise((r) => setTimeout(r, 1000 * kiserlet));
      }
    }
  }
  throw utolsoHiba;
}

function manifestBetoltese() {
  if (!existsSync(manifestPath)) return {};
  return JSON.parse(readFileSync(manifestPath, "utf-8"));
}

function manifestMentese(manifest) {
  writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  );
}

async function sorFeldolgozasa(sor, manifest) {
  const kulcs = String(sor.sorszam);
  const urlek = kepUrlekSorbol(sor);
  const bejegyzes = manifest[kulcs] ?? {
    title: sor.title,
    urlek: [],
    fajlok: [],
    hibak: [],
  };
  bejegyzes.title = sor.title;
  bejegyzes.urlek = urlek;

  if (urlek.length === 0) {
    bejegyzes.fajlok = [];
    manifest[kulcs] = bejegyzes;
    return { kulcs, allapot: "nincs-kep" };
  }

  const sorDir = join(kimenetDir, kulcs);
  mkdirSync(sorDir, { recursive: true });

  const fajlok = [];
  const hibak = [];

  for (let i = 0; i < urlek.length; i++) {
    const url = urlek[i];
    const fajlNev = `${i + 1}.${kiterjesztes(url)}`;
    const fajlUtvonal = join(sorDir, fajlNev);

    if (existsSync(fajlUtvonal) && bejegyzes.fajlok.includes(fajlNev)) {
      fajlok.push(fajlNev);
      continue;
    }

    try {
      const adat = await letoltes(url);
      writeFileSync(fajlUtvonal, adat);
      fajlok.push(fajlNev);
    } catch (hiba) {
      hibak.push({ url, uzenet: String(hiba?.message ?? hiba) });
    }
  }

  bejegyzes.fajlok = fajlok;
  bejegyzes.hibak = hibak;
  manifest[kulcs] = bejegyzes;

  return { kulcs, allapot: hibak.length > 0 ? "hibas" : "ok", hibak };
}

async function parhuzamosFeldolgozas(sorok, manifest) {
  const eredmenyek = [];
  let kovetkezoIndex = 0;

  async function dolgozo() {
    while (kovetkezoIndex < sorok.length) {
      const sajatIndex = kovetkezoIndex++;
      const sor = sorok[sajatIndex];
      const eredmeny = await sorFeldolgozasa(sor, manifest);
      eredmenyek.push(eredmeny);
      if (eredmenyek.length % 25 === 0) {
        console.log(`  ... ${eredmenyek.length}/${sorok.length} sor kész`);
        manifestMentese(manifest);
      }
    }
  }

  await Promise.all(Array.from({ length: PARHUZAMOSSAG }, dolgozo));
  return eredmenyek;
}

async function main() {
  mkdirSync(kimenetDir, { recursive: true });
  const sorok = olvassPostsExport(exportPath);
  const manifest = manifestBetoltese();

  console.log(
    `${sorok.length} sor, letöltés indul (párhuzamosság: ${PARHUZAMOSSAG})...`,
  );
  const eredmenyek = await parhuzamosFeldolgozas(sorok, manifest);
  manifestMentese(manifest);

  const hibas = eredmenyek.filter((e) => e.allapot === "hibas");
  const nincsKep = eredmenyek.filter((e) => e.allapot === "nincs-kep");

  console.log(
    `\nKész. ${eredmenyek.length - hibas.length - nincsKep.length} sor rendben.`,
  );
  if (nincsKep.length > 0) {
    console.log(
      `${nincsKep.length} sornak egyáltalán nincs képe:`,
      nincsKep.map((e) => e.kulcs).join(", "),
    );
  }
  if (hibas.length > 0) {
    console.log(`${hibas.length} sornál volt letöltési hiba:`);
    for (const e of hibas) {
      console.log(`  sor ${e.kulcs}:`, e.hibak.map((h) => h.url).join(", "));
    }
  }
}

main();
