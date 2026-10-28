/**
 * Nominatim (OpenStreetMap) reverse geocode — közös logika a tömeges
 * importhoz (`geocode.mjs`) és az egypontos kereséshez (`geocode-point.mjs`).
 */

export const NOMINATIM_UA =
  "nagypad-projekt/0.1 (egyszeri archívum-import, nem éles forgalom)";

export function helyszinSzoveg(address) {
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

export async function nominatimReverse(lat, lon) {
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
