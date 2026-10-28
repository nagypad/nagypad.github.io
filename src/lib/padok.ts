import { getCollection, type CollectionEntry } from "astro:content";
import { kanonikusCimkek } from "./tags";

export type Pad = CollectionEntry<"padok">;

/**
 * Minden pad, dátum szerint csökkenő sorrendben (holtversenyben a slug
 * szerint) — ez a honlap EGYETLEN rendezési szabálya, nincs külön `order`
 * mező. Determinisztikus: ugyanaz a build mindig ugyanazt a sorrendet adja.
 *
 * A címkék itt kanonizálódnak egyszer, központilag — minden hívó már
 * összevont (alias-mentes) címkelistát kap.
 */
export async function mindenPad(): Promise<Pad[]> {
  const bejegyzesek = await getCollection("padok");
  return bejegyzesek
    .map((pad) => ({
      ...pad,
      data: { ...pad.data, tags: kanonikusCimkek(pad.data.tags) },
    }))
    .sort((a, b) => {
      const dt = b.data.date.getTime() - a.data.date.getTime();
      return dt !== 0 ? dt : a.id.localeCompare(b.id);
    });
}

/** Padok, amiknek van koordinátája — ezek jelennek meg a térképen. */
export function koordinaltPadok(padok: Pad[]): Pad[] {
  return padok.filter((p) => p.data.coords !== undefined);
}

/** Padok, amiknek NINCS koordinátája — az "ismeretlen hely" lista. */
export function ismeretlenHelyuPadok(padok: Pad[]): Pad[] {
  return padok.filter((p) => p.data.coords === undefined);
}

/** Az összes előforduló címke, gyakoriság szerint csökkenő sorrendben. */
export function cimkeGyakorisag(padok: Pad[]): Map<string, number> {
  const szamlalo = new Map<string, number>();
  for (const pad of padok) {
    for (const cimke of pad.data.tags) {
      szamlalo.set(cimke, (szamlalo.get(cimke) ?? 0) + 1);
    }
  }
  return new Map([...szamlalo.entries()].sort((a, b) => b[1] - a[1]));
}

/** A borítófotó — mindig az első elem a galériában, nincs külön `cover` mező. */
export function borito(pad: Pad) {
  return pad.data.photos[0];
}

/** Determinisztikus "véletlen" index egy adott naphoz (YYYY-MM-DD), 0..n-1 között. */
export function napiIndex(nap: string, n: number): number {
  let hash = 0;
  for (let i = 0; i < nap.length; i++) {
    hash = (hash * 31 + nap.charCodeAt(i)) >>> 0;
  }
  return n > 0 ? hash % n : 0;
}
