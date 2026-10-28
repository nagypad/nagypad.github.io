# Nagy Pad Projekt

Padok a világ minden tájáról — fotók, helyszínek, rövid történetek. A régi
[nagypad.hu](http://www.nagypad.hu) blog folytatása, statikus honlapként.

A teljes tervdokumentum: [TERV.md](./TERV.md) — ott van minden döntés
indoklása, a nyitott kérdések és a hátralévő teendők (17. fejezet).

## Helyi futtatás

```sh
npm install
npm run dev        # http://localhost:4321 — élő újratöltéssel
```

**Commit előtt mindig ezt futtasd** — ez pontosan azt építi fel, ami majd
élesben kikerül (OG-képek, feedek, keresés — ezek `dev` közben nem látszanak):

```sh
npm run build
npx astro preview
```

Egyéb hasznos parancsok:

```sh
npm run lint:content        # kép/séma-ellenőrzés (ugyanaz fut CI-ban is)
npm run format:check        # Prettier
```

## Projektszerkezet

```
src/content/padok/<slug>/   egy pad = egy könyvtár (index.md + fotók)
src/pages/                  az útvonalak
src/components/, src/layouts/, src/lib/, src/styles/, src/data/
scripts/                    import- és karbantartó szkriptek (lásd lent)
worker/                     a beküldés-fogadó Cloudflare Worker
archive/                    a régi export + a letöltött eredeti képek (nem megy a build-be)
.github/workflows/          CI/CD — lásd TERV.md 13. fejezet
```

## Az importáló szkriptek

Ezeket csak akkor kell újra futtatni, ha a régi archívumot érintő valami
változik — az élő padok hozzáadása a `/bekuldes/` formon vagy kézzel megy.

```sh
node scripts/fetch-images.mjs     # a blogspot-képek letöltése (már lement)
node scripts/geocode.mjs          # reverse geocode (már lement, cache-elve)
node scripts/import-legacy.mjs    # a kettőből + az exportból előállítja a .md fájlokat
```

## Új pad kézzel

Hozz létre egy könyvtárat `src/content/padok/<slug>/` alatt, tégy bele
`index.md`-t a sémának megfelelő frontmatterrel (lásd egy meglévő padot
mintaként, vagy a `src/content.config.ts`-t) + a fotó(ka)t.

## Állapot és teendők

A TERV.md **17. fejezete** sorolja fel, mi vár rád: a `nagypad` GitHub
szervezet létrehozása és ide átvitel, Cloudflare-fiók a beküldéshez, GitHub
App a Workerhez, Zapier a Facebook-posztokhoz. Addig a honlap a jelenlegi
repóból is build-elhető és böngészhető, a `/bekuldes/` form pedig "teszt
módban" fut (lásd a gyökér `.env.example`-t).
