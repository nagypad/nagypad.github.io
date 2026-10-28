#!/usr/bin/env node
/**
 * Reverse geocode minden koordinátás sorhoz a Nominatim (OpenStreetMap)
 * ingyenes API-jával, a használati feltételeiknek megfelelő 1 kérés/mp
 * tempóban, egyedi (kerekített) koordinátánként egyszer (cache-elve) —
 * így egy ~400 soros importhoz is csak néhány száz, nem ~800 hívás kell,
 * és újrafuttatva a már meglévő cache miatt gyorsan végigfut.
 *
 * A kimenet két dolgot ad minden koordinátához:
 *  - `place`: egy rövid, ember által tovább szerkeszthető szöveg
 *    (pl. "Manhattan, New York, Amerikai Egyesült Államok") — ez kerül a
 *    pad `place` mezőjébe, SZABADON átírható, nem kötött hierarchia.
 *  - `orszag`: a kanonikus ország-címke (lásd TERV.md 9. fejezet — ez is
 *    csak egy sima, szabad címke, nem külön taxonómia).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { olvassPostsExport } from "./lib/posts-tsv.mjs";

const gyokerDir = new URL("..", import.meta.url).pathname;
const exportPath = join(gyokerDir, "archive/posts-export.txt");
const cachePath = join(gyokerDir, "archive/geocode-cache.json");

const NOMINATIM_UA =
  "nagypad-projekt/0.1 (egyszeri archívum-import, nem éles forgalom)";
const KERESEK_KOZOTT_MS = 1100;

function koordKulcs(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function cacheBetoltese() {
  if (!existsSync(cachePath)) return {};
  return JSON.parse(readFileSync(cachePath, "utf-8"));
}

function cacheMentese(cache) {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

function helyszinSzoveg(address) {
  const reszek = [
    address.suburb ||
      address.neighbourhood ||
      address.city_district ||
      address.borough,
    address.city || address.town || address.village || address.municipality,
    address.country,
  ].filter(Boolean);

  // Duplikátum-szűrés (pl. amikor a "város" mező megegyezik az ország
  // kiírt nevével kis településeknél).
  const egyedi = [...new Set(reszek)];
  return egyedi.join(", ");
}

async function nominatimLekeres(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("accept-language", "hu");

  const valasz = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!valasz.ok) throw new Error(`HTTP ${valasz.status}`);
  return valasz.json();
}

async function main() {
  const sorok = olvassPostsExport(exportPath).filter((s) => s.lat && s.lon);
  const cache = cacheBetoltese();

  const egyediKulcsok = [
    ...new Set(sorok.map((s) => koordKulcs(s.lat, s.lon))),
  ];
  const hianyzo = egyediKulcsok.filter((k) => !cache[k]);

  console.log(
    `${sorok.length} koordinátás sor, ${egyediKulcsok.length} egyedi pont, ebből ${hianyzo.length} hiányzik a cache-ből.`,
  );

  for (let i = 0; i < hianyzo.length; i++) {
    const kulcs = hianyzo[i];
    const [lat, lon] = kulcs.split(",").map(Number);
    try {
      const adat = await nominatimLekeres(lat, lon);
      const address = adat.address ?? {};
      cache[kulcs] = {
        place: helyszinSzoveg(address),
        orszag: address.country ?? null,
      };
      console.log(
        `  [${i + 1}/${hianyzo.length}] ${kulcs} → ${cache[kulcs].place || "(üres)"}`,
      );
    } catch (hiba) {
      console.error(
        `  [${i + 1}/${hianyzo.length}] ${kulcs} HIBA: ${hiba.message}`,
      );
      cache[kulcs] = { place: "", orszag: null, hiba: String(hiba.message) };
    }

    if (i % 20 === 0) cacheMentese(cache);
    if (i < hianyzo.length - 1)
      await new Promise((r) => setTimeout(r, KERESEK_KOZOTT_MS));
  }

  cacheMentese(cache);
  console.log("Kész.");
}

main();
