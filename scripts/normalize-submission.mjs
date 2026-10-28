#!/usr/bin/env node
/**
 * A `bekuldes-rendbetetel.yml` Action futtatja minden `pad/*` branch-ről jövő
 * PR-en: a Worker által bekommitolt padot "rendbeteszi", mielőtt a normál
 * PR-ellenőrzés (ellenorzes.yml) lefutna rajta. Lásd TERV.md 12. fejezet.
 *
 * Lépések egy (a PR-ben új vagy módosult) pad könyvtárára:
 *  1. Minden fotó újrakódolása sharp-pal — a kliens már törölte az EXIF-et,
 *     de a szervernek nem hiszünk: újra megtesszük, és ha valami 1600px-nél
 *     nagyobb lenne, lekicsinyítjük.
 *  2. Ha van koordináta, de nincs `place`, egy gyors reverse geocode
 *     (Nominatim, egyetlen hívás — ez nem bulk import, belefér a
 *     használati szabályzatba).
 *  3. Címke-aliasok alkalmazása (`src/data/cimke-aliasok.yml`).
 *
 * A módosításokat NEM ez a szkript commitolja — a workflow teszi meg, ha
 * tényleg változott valami (lásd a .yml `git diff` lépését).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import yaml from "js-yaml";
import sharp from "sharp";

const gyokerDir = new URL("..", import.meta.url).pathname;
const padokDir = join(gyokerDir, "src/content/padok");
const aliasokPath = join(gyokerDir, "src/data/cimke-aliasok.yml");

function erintettPadSlugek() {
  // Milyen pad-könyvtárak új/módosultak a `main`-hez képest ezen a branch-en.
  const kimenet = execSync(
    "git diff --name-only origin/main...HEAD -- src/content/padok",
    {
      cwd: gyokerDir,
      encoding: "utf-8",
    },
  );
  const slugek = new Set();
  for (const sor of kimenet.split("\n")) {
    const match = sor.match(/^src\/content\/padok\/([^/]+)\//);
    if (match) slugek.add(match[1]);
  }
  return [...slugek];
}

async function kepekUjrakodolasa(padDir, fajlNevek) {
  for (const fajlNev of fajlNevek) {
    const utvonal = join(padDir, fajlNev);
    const puffer = await sharp(utvonal)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    writeFileSync(utvonal, puffer);
  }
}

async function helyKitoltese(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "hu");

  const valasz = await fetch(url, {
    headers: {
      "User-Agent": "nagypad-projekt/0.1 (egyszeri beküldés-feldolgozás)",
    },
  });
  if (!valasz.ok) return null;
  const adat = await valasz.json();
  const address = adat.address ?? {};
  const reszek = [
    address.suburb || address.neighbourhood || address.city_district,
    address.city || address.town || address.village,
    address.country,
  ].filter(Boolean);
  return [...new Set(reszek)].join(", ") || null;
}

function cimkekKanonizalasa(cimkek) {
  const aliasok = yaml.load(readFileSync(aliasokPath, "utf-8"));
  return [...new Set(cimkek.map((c) => aliasok[c.toLowerCase()] ?? c))];
}

async function padFeldolgozasa(slug) {
  const padDir = join(padokDir, slug);
  const indexPath = join(padDir, "index.md");
  const nyers = readFileSync(indexPath, "utf-8");
  const match = nyers.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    console.error(`${slug}: nem sikerült beolvasni a frontmattert, kihagyva.`);
    return;
  }
  const frontmatter = yaml.load(match[1]);
  const body = match[2];

  const fotoFajlok = (frontmatter.photos ?? []).map((p) =>
    p.src.replace(/^\.\//, ""),
  );
  const letezoFotok = fotoFajlok.filter((f) => {
    try {
      return statSync(join(padDir, f)).isFile();
    } catch {
      return false;
    }
  });

  console.log(`${slug}: ${letezoFotok.length} fotó újrakódolása...`);
  await kepekUjrakodolasa(padDir, letezoFotok);

  if (frontmatter.coords && !frontmatter.place) {
    console.log(`${slug}: helyszín pótlása koordinátából...`);
    const hely = await helyKitoltese(
      frontmatter.coords[0],
      frontmatter.coords[1],
    );
    if (hely) frontmatter.place = hely;
  }

  if (Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0) {
    frontmatter.tags = cimkekKanonizalasa(frontmatter.tags);
  }

  const yamlSzoveg = yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: '"',
  });
  writeFileSync(indexPath, `---\n${yamlSzoveg}---\n${body}`, "utf-8");
}

async function main() {
  const slugek = erintettPadSlugek();
  if (slugek.length === 0) {
    console.log(
      "Nincs új/módosult pad-könyvtár ezen a branch-en, nincs teendő.",
    );
    return;
  }
  for (const slug of slugek) {
    await padFeldolgozasa(slug);
  }
}

main();
