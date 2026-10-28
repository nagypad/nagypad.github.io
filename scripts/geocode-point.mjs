#!/usr/bin/env node
/**
 * Egypontos Nominatim reverse geocode egy új pad felvételéhez.
 * Használat: node scripts/geocode-point.mjs <lat> <lon>
 * Kimenet (stdout, egy JSON sor): {"place": "...", "orszag": "..."}
 */
import { helyszinSzoveg, nominatimReverse } from "./lib/nominatim.mjs";

const [lat, lon] = process.argv.slice(2).map(Number);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error("Használat: node scripts/geocode-point.mjs <lat> <lon>");
  process.exit(1);
}

const adat = await nominatimReverse(lat, lon);
const address = adat.address ?? {};
console.log(
  JSON.stringify({
    place: helyszinSzoveg(address),
    orszag: address.country ?? null,
  }),
);
