#!/usr/bin/env node
/**
 * A régi nagypad.hu export (`archive/posts-export.txt`) + a már letöltött
 * képek (`archive/images-manifest.json`, lásd `fetch-images.mjs`) + a
 * reverse geocode cache (`archive/geocode-cache.json`, lásd `geocode.mjs`)
 * összefésülése a végleges `src/content/padok/<slug>/index.md` fájlokba.
 *
 * Lásd TERV.md 4. és 14. fejezet. Minden döntés (kihagyott posztok, hiányzó
 * cím/koordináta kezelése) az `archive/kezi-munka.md` fájlba kerül, hogy
 * utólag át lehessen nézni.
 */
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import sharp from "sharp";
import { olvassPostsExport } from "./lib/posts-tsv.mjs";
import { leirasMarkdownKent } from "./lib/html-to-markdown.mjs";
import { slugify, egyediSlug } from "./lib/slug.mjs";

const gyokerDir = new URL("..", import.meta.url).pathname;
const exportPath = join(gyokerDir, "archive/posts-export.txt");
const manifestPath = join(gyokerDir, "archive/images-manifest.json");
const geocodeCachePath = join(gyokerDir, "archive/geocode-cache.json");
const originalDir = join(gyokerDir, "archive/original");
const padokDir = join(gyokerDir, "src/content/padok");
const keziMunkaPath = join(gyokerDir, "archive/kezi-munka.md");

// Ezek a sorok nem padok, hanem a régi blog szerkesztői bejegyzései
// (évfordulós poszt, "200. bejegyzés" összesítő, idézet, és egy kép
// nélküli sor) — lásd TERV.md 2. fejezet, nincs mit importálni belőlük.
const NEM_PAD_SOROK = new Set([189, 210, 240, 368]);

function koordKulcs(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function datumSorbol(url) {
  const match = url.match(/\/(\d{4})\/(\d{2})\//);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}

async function kepekAtmasolasa(sorszam, slug, fajlNevek) {
  const celDir = join(padokDir, slug);
  mkdirSync(celDir, { recursive: true });

  const eredmeny = [];
  for (let i = 0; i < fajlNevek.length; i++) {
    const forras = join(originalDir, String(sorszam), fajlNevek[i]);
    const celNev = `${i + 1}.jpg`;
    const cel = join(celDir, celNev);
    // Sharp-pal újrakódolva: EXIF (benne a GPS) törlődik, egységes JPEG
    // minden fotóhoz, a méret marad (a blogspot /s1600/ már amúgy is
    // max 1600px — lásd TERV.md 14. fejezet).
    await sharp(forras)
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(cel);
    eredmeny.push(celNev);
  }
  return eredmeny;
}

async function main() {
  // Tiszta lappal indulunk: a korábbi teszt-padok (M0) eltávolítása, hogy
  // ne keveredjenek a valódi importtal.
  for (const nev of readdirSync(padokDir, { withFileTypes: true })) {
    if (nev.isDirectory() && nev.name.startsWith("teszt-pad-")) {
      rmSync(join(padokDir, nev.name), { recursive: true, force: true });
    }
  }

  const sorok = olvassPostsExport(exportPath);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const geocodeCache = existsSync(geocodeCachePath)
    ? JSON.parse(readFileSync(geocodeCachePath, "utf-8"))
    : {};

  const foglaltSlugek = new Set();
  const keziMunka = [];
  let importalva = 0;
  let ismeretlenHely = 0;
  let geocodeHianyzik = 0;

  for (const sor of sorok) {
    if (NEM_PAD_SOROK.has(sor.sorszam)) continue;

    const manifestBejegyzes = manifest[String(sor.sorszam)];
    const fajlNevek = manifestBejegyzes?.fajlok ?? [];
    if (fajlNevek.length === 0) {
      keziMunka.push(
        `- **${sor.title || "(cím nélkül)"}** (${sor.url}) — nincs letöltött kép, kézzel pótolandó.`,
      );
      continue;
    }

    const vanKoordinata = Boolean(sor.lat && sor.lon);
    let hely;
    if (vanKoordinata) {
      const kulcs = koordKulcs(sor.lat, sor.lon);
      hely = geocodeCache[kulcs];
      if (!hely || hely.hiba) {
        geocodeHianyzik++;
        keziMunka.push(
          `- **${sor.title || "(cím nélkül)"}** (${sor.url}) — a geocode nem adott vissza helyszínt, kézzel pótolandó.`,
        );
      }
    } else {
      ismeretlenHely++;
    }

    let cim = sor.title.trim();
    if (!cim) {
      cim = hely?.place || "Névtelen pad";
      keziMunka.push(
        `- (üres cím, "${cim}"-ra állítva) — ${sor.url} — érdemes igazi nevet adni.`,
      );
    }

    const alapSlug = slugify(cim);
    const slug = egyediSlug(alapSlug, foglaltSlugek);

    const fotoFajlok = await kepekAtmasolasa(sor.sorszam, slug, fajlNevek);

    const frontmatter = {
      title: cim,
      date: datumSorbol(sor.url) ?? "2012-01-01",
    };
    if (vanKoordinata) frontmatter.coords = [Number(sor.lat), Number(sor.lon)];
    if (hely?.place) frontmatter.place = hely.place;

    const tagek = [];
    if (hely?.orszag) tagek.push(hely.orszag.toLowerCase());
    frontmatter.tags = tagek;

    frontmatter.photos = fotoFajlok.map((fajlNev) => ({ src: `./${fajlNev}` }));
    frontmatter.credit = "a régi nagypad.hu csapata";
    frontmatter.legacyUrl = sor.url;

    const leiras = leirasMarkdownKent(sor.description);
    const yamlSzoveg = yaml.dump(frontmatter, {
      lineWidth: -1,
      quotingType: '"',
    });
    const tartalom = `---\n${yamlSzoveg}---\n\n${leiras}\n`;

    writeFileSync(join(padokDir, slug, "index.md"), tartalom, "utf-8");
    importalva++;
  }

  const keziMunkaSzoveg = [
    "# Kézi munka az import után",
    "",
    `Automatikusan importált padok: ${importalva}`,
    `Ismeretlen helyű pad (nincs koordináta): ${ismeretlenHely}`,
    `Geocode nélküli koordináta: ${geocodeHianyzik}`,
    "",
    ...keziMunka,
    "",
  ].join("\n");
  writeFileSync(keziMunkaPath, keziMunkaSzoveg, "utf-8");

  console.log(`Kész. ${importalva} pad importálva.`);
  console.log(`  ismeretlen helyű: ${ismeretlenHely}`);
  console.log(`  geocode nélküli (kézi pótlás kell): ${geocodeHianyzik}`);
  console.log(`Részletek: archive/kezi-munka.md`);
}

main();
