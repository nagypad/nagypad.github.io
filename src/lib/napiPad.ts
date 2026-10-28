// Statikus import (nem `fs.readFileSync`): Vite ezt a build-time "prerender"
// lépésben is el tudja érni, mert bundle-eli, nem a fájlrendszerről olvassa
// futásidőben. A tartalom a `scripts/napi-pad.mjs` naponta frissíti és
// commitolja — minden új build a legfrissebb állapotot látja.
import naplo from "../data/napi-pad.json";
import { koordinaltPadok, napiIndex, type Pad } from "./padok";

interface NapiPadNaplo {
  mai?: { nap: string; slug: string };
  mutatott?: string[];
}

function maiNap(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "A nap padja" — build időben dől el, hogy mindenki ugyanazt lássa (RSS,
 * megosztás, FB-poszt is ugyanerre mutat).
 *
 * A forrás a `scripts/napi-pad.mjs` által naponta frissített és commitolt
 * `src/data/napi-pad.json` napló: a mai naphoz húzott slug. A sorsolás a
 * TELJES padlistából megy (archív és új pad között nincs különbség), de csak
 * olyan padból, amihez VAN koordináta — egy "ismeretlen hely" pad térkép
 * nélkül rosszul mutatna a címlap hero-jában.
 *
 * Ha a napló hiányzik vagy a mai nap még nincs benne (pl. helyi `astro dev`
 * közben, a cron lefutása előtt), egy determinisztikus — de nem állapot-
 * mentes, csak az aktuális padlistára épülő — hash-alapú kiválasztás ugrik
 * be helyette, hogy a fejlesztés közben is mindig legyen "nap padja".
 */
export function napPadja(padok: Pad[]): Pad {
  const eselyesek = koordinaltPadok(padok);
  if (eselyesek.length === 0) {
    // Üres/teszt-állapotban (pl. egyetlen koordináta nélküli teszt-pad)
    // inkább visszaadjuk az első elérhető padot, mint hogy elhasaljunk.
    return padok[0];
  }

  const tipizaltNaplo = naplo as NapiPadNaplo;
  if (tipizaltNaplo.mai?.nap === maiNap()) {
    const talalt = eselyesek.find((p) => p.id === tipizaltNaplo.mai!.slug);
    if (talalt) return talalt;
  }

  const index = napiIndex(maiNap(), eselyesek.length);
  return eselyesek[index];
}
