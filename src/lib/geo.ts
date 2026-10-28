/** Két koordináta távolsága méterben (haversine-formula). */
export function tavolsagMeter(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const R = 6_371_000;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}
