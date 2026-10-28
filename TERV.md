# Nagy Pad Projekt — terv

> Állapot: **megvalósítva kódban (M0–M4), élesítés előtt áll** · 2026-10-28.
> A kód a repóban van, a 406 archív pad importálva és böngészhető helyben
> (`npm run build && npx astro preview`). Ami hiányzik, az kizárólag a
> 17. fejezetben felsorolt, fiókokhoz/szervezethez kötött lépések — a
> kódnak ettől függetlenül nem kell változnia.
> Cél: a megszűnt nagypad.hu blog anyagát és a jövőbeli padokat egy modern, statikus,
> GitHub Pages-en futó honlapon gyűjteni, közösségi beküldéssel.

---

## 0. Eldöntött kérdések

| Kérdés | Döntés |
|---|---|
| Domain | **Nincs.** Külön GitHub **szervezet**: `nagypad` (a név szabad) → **`https://nagypad.github.io/`**, gyökér-útvonalon |
| Repó | A szervezet `nagypad.github.io` repója maga a honlap. Publikus. (Ez a mostani repó oda kerül át.) |
| Képtárolás | **Minden kép a repóban.** Nincs külső képszolgáltató. |
| Címlap | **„A nap padja"** (build-time, napi újraépítés), nem kliensoldali véletlen |
| Nap padja merítése | **A teljes padlistából**, archív és új között nincs különbség |
| Helyszín | **Egyetlen sima szöveg mező.** Nincs ország/város/régió hierarchia |
| Címkék | **Szabad címkézés**, nincs kötelező szótár. 20–30 alapcímke magként, később AI-segített nagy kör |
| Facebook | Van Page. **RSS → Zapier → Page.** Nincs saját FB-app, nincs Graph API |
| Beküldés | **Webes form a honlapon → Cloudflare Worker → kész PR.** Nincs GitHub issue form, nincs e-mail-kérés |
| Worker jogosultság | **GitHub App** (önmegújuló token), nem lejáró PAT — lásd 12. |
| Régi URL-ek | Nem őrizzük meg (nincs mit) |
| Koordináta nélküli padok | „**Ismeretlen hely**" kategória, később kézi pótlás |
| Pad-sorszám | Nem jelenik meg |
| Régi fotók kreditje | „**a régi nagypad.hu csapata**" |
| Frontmatter | A minimumra csupaszítva: nincs `slug`, `cover`, `order`, `draft`, `source`, `taken`, `datePrecision` |

---

## 1. Alapelvek

1. **Statikus és örökéletű.** Nincs szerver, nincs adatbázis, nincs fenntartási díj. A tartalom
   egyszerű Markdown-fájl a repóban: 20 év múlva is olvasható, bárhová átvihető.
   (Egyetlen külső mozgó alkatrész a beküldő Worker — ha az kiesik, a honlap teljesen működik.)
2. **A kép a főszereplő.** Egy pad = egy fotó + egy hely + pár szó. A dizájn ne tolakodjon.
3. **Minden pad önálló, megosztható oldal** saját URL-lel, OG-képpel, koordinátával.
4. **Az adat kimenthető.** Minden pad elérhető JSON/GeoJSON/RSS formában is, hogy
   automatizálni lehessen (Facebook, térképek, bármi).
5. **Beküldés regisztráció nélkül.** Ez vezette a 12. fejezet átírását.
6. **Egy moderálási felület.** Minden beküldés ugyanúgy jelenik meg: kész pull request.
7. **Magyar nyelvű**, de a világ minden tájáról.

---

## 2. Mi van most (meglévő adatkincs)

A repóban két tabulátorral tagolt export van: `posts (1).txt` (411 sor, ez a hasznos) és
`sizes.txt` (ugyanaz, kevesebb oszloppal — **eldobható**).

`posts (1).txt` oszlopai: `lat, lon, title, img, url, icon, iconSize, iconOffset, description,
imgwidth, imgheight` — az utolsó négy a régi térkép-widget maradványa, nem kell.

Mért állapot:

| Jellemző | Érték | Következmény a tervre |
|---|---|---|
| Posztok száma | 410 | Minden statikusan legenerálható, nincs méretprobléma |
| Évek | 2012 (179), 2013 (157), 2014 (67), 2015 (5), ismeretlen (2) | Dátum a blog-URL-ből (`/2015/01/`) kinyerhető, nap nélkül |
| Koordináta nélkül | 7 | „Ismeretlen hely" kategória |
| Főkép nélkül | 10 | Lehet, hogy a `description`-ben van kép; ha nincs, placeholder |
| Képek száma / poszt | 0: 6 · 1: 327 · 2: 54 · 3+: 23 (max 11) | A „kiegészítő kép" igény már most is létező adat → **képgaléria kell**, nem egy fix „extra kép" mező |
| Leírás | **287 posztnak nincs szövege**, a többi is rövid (p90 = 116 karakter) | A dizájn ne feltételezzen szöveget. A leírás *opcionális* |
| Címke | **nincs** | Címkézés utólag, lásd 9. |
| A `description` tartalma | Blogger-féle HTML (`<div class="separator">`, `<table class="tr-caption-container">`, `<img>`) | Importnál ki kell bontani: képek → galéria, szöveg → tiszta Markdown |
| Régi blog | **nem él** | Az export + a képek URL-jei az egyetlen forrás |
| Képek | `*.bp.blogspot.com/.../s1600/...` — élnek | **Mindet le kell tölteni, amíg lehet** (M1 első feladata) |

> **Sürgősségi megjegyzés:** a Blogger-képek bármikor eltűnhetnek, és 287 posztnál a kép *az egész*
> tartalom. A képletöltő szkript az első megírandó dolog, még a honlap előtt.

---

## 3. Technológiai döntések

| Terület | Döntés | Miért |
|---|---|---|
| Statikus generátor | **Astro 5** | Beépített képoptimalizálás (sharp → WebP/AVIF, `srcset`), content collection + Zod séma (= ingyen validáció a beküldésekhez), `@astrojs/rss`, sitemap, alapból 0 kliens-JS, a térkép „sziget"-ként töltődik |
| Tartalom | Markdown + YAML frontmatter, egy fájl = egy pad | Ember által szerkeszthető, Git-ben diffelhető, PR-ban reviewálható |
| Térkép | **MapLibre GL JS** | Szabad, vektoros, pörgős, klaszterezés beépítve |
| Térkép-tile | **OpenFreeMap** (kulcs nélkül, ingyen) | Nincs regisztráció, nincs limit, OSM-alapú. Env-változóval cserélhető (MapTiler) |
| Keresés | **Pagefind** (build-time index, kliensoldali) | Zero-config, 410 oldalhoz pehelysúlyú |
| CSS | Saját CSS (custom properties, dark mode) | 410 fotós oldalhoz nem kell framework |
| Hosting | GitHub Pages + GitHub Actions | Ingyen, a repó mellett |
| Beküldés-fogadó | **Cloudflare Worker** (ingyen tier) + Turnstile | Az egyetlen dolog, amit nem lehet statikusan megoldani |
| Analitika | **GoatCounter** vagy semmi | Süti nélküli, nem kell cookie-banner |

Node 22 LTS, pnpm, Prettier. Repóban `.nvmrc`.

A szervezet-névre épülő URL (`nagypad.github.io`) miatt **nincs base path** → nincs útvonal-fájdalom,
és ha egyszer lesz domain, csak az Astro `site` értéke változik. Az OG-képeket és a feedeket
mindenképp **absz. URL**-lel generáljuk (`site` konfigból).

### 3.1 Helyi előnézet — commit előtt

Minden megnézhető a gépen, Docker nélkül, csak Node kell:

| Mit akarsz | Mit futtatsz | Mit kapsz |
|---|---|---|
| Szerkesztés élő újratöltéssel | `pnpm dev` | `http://localhost:4321` — mentésre azonnal frissül |
| **Pontosan azt látni, ami kikerül** | `pnpm build && pnpm preview` | A legenerált statikus oldal kiszolgálva, ugyanazzal a HTML-lel, OG-képekkel, feedekkel |
| Csak ellenőrzés | `pnpm build` | Elhasal, ha bármelyik pad fájlja hibás (Zod séma) |
| Beküldés-form tesztelése | `pnpm wrangler dev` (M4-től) | A Worker helyben, teszt-módban |

Fontos: a **keresés (Pagefind), az OG-képek és a feedek csak `build` után léteznek** — a `dev`
szerverben nem látszanak. Szóval: `dev` a munkához, `build && preview` az „így lesz élesben"
ellenőrzéshez. Commit előtt a `build` lefuttatása amúgy is kötelező reflex, mert ugyanazt futtatja,
amit a CI.

Egy beküldött PR helyi megnézése: `gh pr checkout <szám>` majd `pnpm dev`.

Astro gyorsítótár: az első build az 500 képpel lassú (pár perc), utána a `node_modules/.astro`
cache miatt másodpercek. Ezt a cache-t az Actionsben is eltesszük.

---

## 4. Adatmodell

Egy pad = `src/content/padok/<slug>/index.md` + mellette a képek.
**A könyvtár neve a slug, és az a slug az URL** → nincs rá külön frontmatter mező.

```markdown
---
title: High Line
date: 2015-01-03
coords: [40.7449389, -74.0069228]  # [lat, lon] — elhagyható → „ismeretlen hely"
place: Manhattan, New York, Amerikai Egyesült Államok   # EGY sima szöveg, szabadon átírható
tags: [város, fém, kilátás, usa]
photos:
  - src: ./1.jpg
    caption: ""                  # opcionális
  - src: ./2.jpg
credit: a régi nagypad.hu csapata   # ki fotózta / küldte — megjelenik a pad oldalán
legacyUrl: http://www.nagypad.hu/2015/01/high-line.html   # csak nyomkövetés, nem linkeljük
---

Manhattanben egy nem használt hosszú vágányt parkká alakítottak három emelet
magasan. És elég jól.
```

Nyolc mező, ebből három kötelező (`title`, `date`, `photos`). Megjegyzések:

- **A leírás a Markdown törzs**, nem frontmatter mező → lehet hosszabb, formázott, linkelhető.
- **A borító mindig az első fotó.** Átrendezés = borítócsere, ennyi.
- **A `place` egyetlen szöveg.** A reverse geocode csak *kitölti* az importnál/beküldésnél, utána
  sima szerkeszthető szöveg, bármit beírhatsz („a nagyi háza előtt"). Az országonkénti böngészés
  **címkével** történik (lásd 9.) — így egy taxonómia van, nem kettő.
- **Slug = könyvtárnév.** A címből képzett kebab-case, ütközésnél `-2` (a 4 duplikált cím miatt
  kell). Egy szabály jár vele: **a könyvtárat soha nem nevezzük át**, mert az a megosztott URL.
  (A `kephigienia.yml` figyelmeztet, ha egy könyvtárnév mégis megváltozott.)
- **Sorrend:** `date` szerint, holtversenyben a könyvtárnév szerint → determinisztikus, állandó,
  külön `order` mező nélkül.
- **Dátum-megjelenítés:** a régi posztoknál csak év-hónap van (a blog-URL-ből), ezért a `date`
  náluk a hónap 1-je. Hogy ne mutassunk kitalált napot, a honlap **mindenhol „2012. március"
  formában írja ki** a dátumot. Így nem kell `datePrecision` mező.
- **Elrejtés:** nincs `draft` mező. Amit nem akarsz kint, azt nem commitolod (vagy ágon hagyod).
- **Honnan jött:** nincs `source`/`submissionRef` — a `credit` mutatja, ki fotózta, a többit
  (ki, mikor, melyik PR-ben hozta be) a fájl Git-története tudja.
- **Zod séma** (`src/content.config.ts`): a build elhasal hibás fájlon → ez a CI-validáció gerince,
  nem kell külön validátort írni a beküldéshez.

---

## 5. Könyvtárszerkezet

```
.
├── src/
│   ├── content/padok/<slug>/index.md + 1.jpg, 2.jpg …
│   ├── content.config.ts           # Zod séma
│   ├── data/
│   │   ├── cimkek-alap.yml         # a 20-30 alapcímke (autocomplete magja)
│   │   ├── cimke-aliasok.yml       # elírás-összevonás ("fem" → "fém")
│   │   └── napi-pad.json           # a „nap padja" sorsolási napló (commitolva)
│   ├── layouts/ components/ pages/ styles/
│   └── lib/                        # slug, geo, feed segédfüggvények
├── scripts/
│   ├── fetch-images.mjs            # blogspot képek letöltése            ← M1 első
│   ├── import-legacy.mjs           # posts (1).txt → .md fájlok
│   ├── geocode.mjs                 # Nominatim reverse geocode, cache-elve
│   └── normalize-submission.mjs    # beküldött kép + adat rendbetétele (Action)
├── worker/                         # Cloudflare Worker (beküldés-fogadó)
│   ├── src/index.ts
│   └── wrangler.toml
├── .github/workflows/              # lásd 13.
├── archive/                        # nyers export + geocode/kép naplók, megőrizve
└── TERV.md
```

---

## 6. Oldalszerkezet / URL-ek

| URL | Tartalom |
|---|---|
| `/` | Címlap (lásd 7.) |
| `/pad/<slug>/` | Egy pad: nagy fotó, galéria, leírás, minitérkép, címkék, megosztás, szomszédos padok |
| `/padok/` | Összes pad rácsban, lapozva, szűrhető (címke, év), rendezhető |
| `/terkep/` | Teljes képernyős térkép (lásd 8.) |
| `/cimke/<slug>/` | Egy címke padjai |
| `/cimkek/` | Teljes címkefelhő + statisztika |
| `/ismeretlen-hely/` | A koordináta nélküli padok — „segíts megtalálni" felhívással |
| `/veletlen/` | Átirányít egy véletlen padra (apró JS, statikusan) |
| `/bekuldes/` | **A beküldő form** (lásd 12.) |
| `/rolunk/`, `/licenc/` | Statikus oldalak |
| `/rss.xml` | Legfrissebb 20 pad, teljes szöveggel + képpel |
| `/feed/napi-pad.xml` | **Napi pad** feed — naponta egy új item az archívumból (lásd 11.) |
| `/padok.json`, `/padok.geojson` | Teljes adat API-ként |
| `/sitemap-index.xml`, `/404.html` | SEO / hibaoldal |

Trailing slash: mindig `/`. A slug soha nem változik → a megosztott linkek örökké élnek.
Ha később lesz domain, az útvonalak változatlanul átvihetők (csak a `base` tűnik el).

---

## 7. Címlap

1. **Hero — A nap padja.** Teljes szélességű fotó, rajta a pad neve és helye, alatta a leírás,
   ha van. Egy klikk → a pad oldala. Mellette: „Másik padot kérek" → `/veletlen/`.
   Build időben dől el a dátumból → megosztható, cache-elhető, és egyben ez a napi FB-tartalom.
2. **Számláló-sáv.** „410 pad · 31 ország · 2012 óta" — egy sor, apró betű, de azonnal
   megmutatja, hogy ez egy *gyűjtemény*.
3. **Legfrissebb padok.** 6 kártya (fotó + név + hely), „Mind (410) →".
4. **Minitérkép.** ~400px magas, klaszterezett, egy klikk a `/terkep/`-re visz. Lazy-loadolva
   (`client:visible`) — a térkép JS-t ne fizesse meg minden címlap-látogató.
5. **Címkefelhő.** Top 30 címke, méret = padszám. „Összes címke →".
6. **Beküldés-csík.** „Láttál egy jó padot? Küldd be — 1 perc, regisztráció nélkül." → `/bekuldes/`
7. **Lábléc.** RSS, API-linkek, licenc, kredit.

Dizájn-irány: sok fehér (sötét módban sok fekete), nagy fotók, egy karakteres kijelző-betűtípus a
címekhez + jól olvasható szövegbetű. A régi `images/pad.png` ikon utódja mint logó és térkép-marker.

---

## 8. Térképes nézet

- MapLibre GL JS, OpenFreeMap „liberty"/„positron" stílus.
- Adat: build időben generált `/padok.geojson` (csak `slug`, `title`, `place`, `thumb` →
  410 feature ≈ 60–100 kB).
- **Klaszterezés** (`cluster: true`), klaszter-számmal; zoomolásnál szétnyílik.
- Marker: kis kerek fotó-thumbnail (40px) a pad képéből — ez adja a „modern" érzetet.
- Klikk → popup: fotó, név, hely, „Megnyitom →".
- Szűrő (címke / év) — ugyanaz a szűrőlogika, mint a `/padok/` oldalon.
- „Hol vagyok" gomb + „a hozzám legközelebbi pad" (haversine, kliensoldalon).
- URL-ben őrizzük a nézetet (`#12/47.49/19.05`) → megosztható térképnézet.
- Mobil: teljes magasság, alul becsúszó kártya-lista.
- A pad-oldali minitérkép ugyanaz a komponens, egy markerrel, `interactive: false`.

---

## 9. Címkék — szabad címkézés

**Nincs kötelező szótár.** Bárhonnan jöhet új címke (tőled, beküldőtől), a honlap mindet kezeli.
Ami a drift ellen véd, az nem tiltás, hanem két puha eszköz:

1. **`src/data/cimke-aliasok.yml`** — elírások és szinonimák összevonása build időben:
   ```yaml
   fem: fém
   tengerparti: tengerpart
   new-york: usa
   ```
   A címkeoldalak az összevont (kanonikus) címkére épülnek, a régi link átirányít.
2. **CI-figyelmeztetés (nem hiba):** a build kiírja azokat a címkéket, amik csak 1 padon
   szerepelnek → ezek a tipikus elírások, egy pillantás alatt átnézhetők.

A címkebevitel segítése: a beküldő formon és a saját szerkesztésnél **automatikus kiegészítés** a
már létező címkékből (build-time generált `/cimkek.json`) → a legtöbb ember a meglévőt választja,
nem újat gyárt.

### Alapcímkék (`src/data/cimkek-alap.yml`)

Hogy az autocomplete ne legyen üres az első napon, 20–30 címke magként bekerül. Javaslat
(finomítjuk, amikor konkrétan nézzük):

```
környezet:  tengerpart · vízpart · hegy · erdő · park · város · falu · templom ·
            temető · állomás · út mellett · kert
kilátás:    panoráma · naplemente · híd · folyó
anyag:      fa · fém · kő · beton · vegyes
jelleg:     körpad · hintapad · egyszemélyes · hosszú · asztallal · háttámla nélkül ·
            rögtönzött · mobil
állapot:    romos · vadonatúj · felirattal · benőtt
```

A csoportok csak a felsorolás kedvéért vannak itt — a rendszerben **egyszintű, lapos címkelista**
van, nincs kategória-mező. Az ország-címkék ehhez jönnek automatikusan az importból.

Országok is címkék (`usa`, `olaszország`, `horvátország`) — az importnál automatikusan
rákerülnek a reverse geocode alapján. Így a földrajzi böngészéshez nem kell külön rendszer:
megvan a térkép és megvan a címke.

### Nagy címkézési kör — AI-segítséggel (tervezett, M+1)

A 410 archív pad jelenleg **címkézetlen**, és 287-nek szövege sincs. Ezért tervezett külön munkafázis:

> **Claude végigmegy a 410 pad fotóján és adatain, és javaslatot generál**: 3–6 címke padonként,
> és ahol üres, ott egy 1–2 mondatos leírás is. A javaslat **batch-enként kerül PR-be**
> (pl. 40 pad / PR, a diff jól átnézhető), te végigpörgeted és módosítod/jóváhagyod.
> Ebből jön létre a címkekészlet első „nagy sora" — nem előre kitalált szótárból, hanem abból,
> ami tényleg látható a fotókon.

Ezt szándékosan **nem** az elején végezzük: előbb legyen honlap és legyen látható az anyag,
mert a címkerendszer alakját az fogja megmondani, mit látunk a 410 fotón.
A generált leírásnál mindig látszódjon, hogy nem emberi szöveg-e (frontmatter flag, pl.
`descriptionSource: ai`), hogy később át lehessen írni.

---

## 10. Facebook-megosztás

- **Open Graph + Twitter Card** minden oldalon: `og:title`, `og:description`, `og:url`,
  `og:image` (**absz. URL**, base path-fal!), `og:image:width/height`, `og:type=article`,
  `og:locale=hu_HU`, `article:published_time`, `place:location:latitude/longitude`.
- **OG-kép**: build időben 1200×630-ra vágott változat a borítófotóból (sharp).
  Második körben „márkás kártya" (fotó + sötét gradiens + pad neve és helye, `satori`-val) —
  ettől a FB-feedben azonnal felismerhető a projekt.
- **Megosztás gomb**: egyszerű link `facebook.com/sharer/sharer.php?u=<url>` — nincs FB SDK,
  nincs süti, nincs cookie-banner-kötelezettség. Mellette `navigator.share()` mobilon és
  „link kimásolása".
- Induláskor egyszer végigfuttatni a FB Sharing Debuggert (cache-ürítés).

---

## 11. Feedek és automatizált megosztás

1. **`/rss.xml`** — legfrissebb 20 pad. Itemenként: cím, hely, teljes leírás, `<enclosure>` **és**
   `media:content` a fotóval (hogy a Zapier tudjon képet csatolni), `georss:point`.
2. **`/feed/napi-pad.xml`** — *a gyűjtemény újrahasznosítása*. Napi GitHub Actions cron újraépíti az
   oldalt; a feed legfelső iteme a nap padja, `pubDate`-je az aznapi dátum.
   **Ez a feed táplálja a napi Facebook-posztot** → napi tartalom kézi munka nélkül, több mint egy évre.

   A sorsolás **a teljes padlistából** megy (nincs „archív" és „új" megkülönböztetés). A napló
   (`src/data/napi-pad.json`, commitolva) azt tartja számon, mi volt már: a következő pad a
   még nem szerepeltek közül kerül ki véletlenszerűen, és csak ha mind lement, indul új kör.
   Így az időközben felvitt padok maguktól bekerülnek a merítésbe.
3. **`/padok.json` + `/padok.geojson`** — teljes adat bármilyen más automatizáláshoz.

**Facebook-posztolás: RSS → Zapier → Facebook Page.** Nem kell saját FB-app és review: a Zapier
Facebook Pages integrációja a te oldal-adminod jogán posztol. A napi egy poszt ~30 Zapier-task/hó,
ez belefér az ingyenes tier-be (100/hó). A free tier RSS-trigger 15 percenként nézi a feedet — napi
posztnál ez tökéletes. (Alternatíva, ha a Zapier szűk lesz: Make.com vagy Buffer, ugyanez a feed.)

A Graph API-s saját automatizálás (FB app + page token) **nincs a tervben** — app-review nélkül
nem stabil, és a 60 naponkénti token-megújítás kézi munka.

Ugyanez a feed mehet később Telegram/Mastodon/Bluesky-ra is.

---

## 12. Beküldés — webes form, GitHub nélkül

A GitHub issue form **fiókot igényelt** volna, és issue-szöveget kellett volna visszaparse-olni —
a terv legtörékenyebb pontja. Mivel a Worker mindenképp kell a regisztráció nélküli beküldéshez,
**az issue-s réteg teljesen kimarad.** A form strukturált adatot küld, abból a Worker **egyből
kész pull requestet** nyit. Egy moderálási felület van: a PR.

### A folyamat

```
[/bekuldes/ oldal — statikus HTML + JS]
   • fotó kiválasztása (max 4)
   • EXIF-ből kiolvassa a GPS-t  → koordináta automatikusan kitöltve
   • térképen igazítható a marker (MapLibre, ugyanaz a komponens)
   • „Itt vagyok most" gomb (geolocation, mobilon)
   • reverse geocode → a `place` szöveg előkitöltve, szabadon átírható
   • címkék: autocomplete a létező címkékből + újat is írhat
   • a képeket a BÖNGÉSZŐ méretezi 1600px-re (canvas) → kis feltöltés, EXIF eltűnik
   • Turnstile captcha
          │  POST (JSON, base64 képek)
          ▼
[Cloudflare Worker]
   • Turnstile-ellenőrzés
   • rate limit (KV: IP / nap)
   • validáció: mezőhosszak, koordináta-tartomány, max 4 kép, képméret, magic-byte típus
   • slug képzése (ütközés-ellenőrzés a repó tartalma ellen)
   • GitHub API (GitHub App installation token, csak erre a repóra, Contents+PR write):
        blob-ok → tree → commit → `pad/<slug>-<rövid-hash>` ág → PULL REQUEST
   • válasz: a PR URL-je → a form kiírja: „Köszönjük! A padod itt várja a jóváhagyást: <link>"
   • HA a GitHub API nem elérhető → a beküldés KV-be kerül („postafiók"), a beküldő azt látja:
        „Megkaptuk, de most kézi feldolgozás kell — nem veszett el." (lásd lent)
          │
          ▼
[GitHub Action: bekuldes-rendbetetel.yml]  (a bot ágán nyitott PR-re)
   • kép újrakódolás (sharp): max 1600px, q82, EXIF/GPS törlés — a böngészőnek nem hiszünk
   • ha a `place` üres: szerveroldali reverse geocode
   • frontmatter normalizálás, címke-aliasok alkalmazása
   • a javításokat visszacommitolja a PR ágára
          ▼
[GitHub Action: ellenorzes.yml]
   • Zod séma + teljes build + képlint + duplikátum-gyanú (van-e már pad 50 m-en belül → komment)
          ▼
[TE: megnézed a PR-t (a GitHub mobilapp is jó), módosítasz, ha kell → Merge]
          ▼
main → Pages deploy → élő pad
```

Fontos: a Worker **nem merge-öl**, csak PR-t nyit. A honlapra semmi nem kerül emberi jóváhagyás
nélkül. Ha a Worker kiesik vagy spam-támadás alá kerül, a honlap érintetlen — csak a beküldés áll.

### Form mezői

| Mező | Köt. | Megjegyzés |
|---|---|---|
| Fotó(k) | ✓ | max 4, böngészőben méretezve; az elsőből lesz a borító |
| A pad neve | ✓ | 3–60 karakter |
| Hol van? (koordináta) | ✓* | EXIF-ből / „itt vagyok"-ból / térképen klikkelve. *Ha semmiképp nincs: „nem tudom" → ismeretlen hely |
| Helyszín szövegesen | – | reverse geocode-ból előkitöltve, átírható |
| Mit lehet róla tudni? | – | max ~800 karakter |
| Mikor készült? | – | EXIF-ből előkitöltve, ha van |
| Címkék | – | autocomplete + szabad szöveg |
| Ki küldte? | ✓ | „Olyan nevet írj, amiről felismerünk" — ez lesz a kredit a pad oldalán. Becenév jó; aki nem akar szerepelni, írhatja azt, hogy *anonim*. E-mail-címet **nem kérünk** |
| Nyilatkozat | ✓ | „A fotót én készítettem vagy jogom van közzétenni, és hozzájárulok a CC BY-SA 4.0 licenchez." |

### Jogosultság: GitHub App, nem lejáró token

A fine-grained PAT-nak van egy csúnya tulajdonsága: **legfeljebb 1 évre adható** (a „soha nem jár
le" opció létezik, de pont azt a biztonsági előnyt dobja el, amiért választottuk), és amikor lejár,
*némán* dől el a beküldés — hónapokkal később, amikor már nem is gondolsz rá. Plusz
szervezeti repónál a PAT-okat az org beállítása külön jóváhagyatni is kérheti.

Ezért: **GitHub App** a szervezetre telepítve. Az App *installation tokenje* 1 óráig él, és a Worker
minden kéréskor magának váltja ki (App ID + privát kulcs a Worker secretjében, RS256 JWT —
a Workers WebCrypto tudja). **Így nincs lejárat, nincs naptárba írt emlékeztető.** A plusz
munka egyszeri: az App létrehozása és telepítése, kb. 30 sor Worker-kód.

### Ha mégis elhasal: mit lát a beküldő és mit lát a repó?

Ez volt a jó kérdés — három rétegben kezeljük, mert néma hiba nem elfogadható:

**a) A beküldő.** A Worker minden GitHub-válaszkódot megvizsgál. Hiba esetén nem „valami hiba
történt" jön, hanem a beküldés **bekerül a Worker KV-postafiókjába** (a 4 kép ~1 MB, bőven belefér),
és a form azt írja: *„Megkaptuk a padot, de most kézi feldolgozás alatt van — nem veszett el.
Ha pár napon belül nem jelenik meg, írj ide: `<e-mail>`."* A beküldés tehát sosem tűnik el
csak azért, mert a GitHub felé akadt el valami.

**b) A repó.** A Worker nem tud a repónak szólni, ha épp a repó felé nincs jogosultsága — ezért
a **repó kérdezi a Workert**, nem fordítva: egy napi `worker-egeszseg.yml` Action meghívja a Worker
`/health` végpontját, ami

- megpróbál egy ártalmatlan, hitelesített GitHub-hívást (pl. repó-adat lekérés),
- megmondja, hány beküldés vár a KV-postafiókban,
- és visszaadja az App-telepítés állapotát.

Ha bármi nem stimmel, **a workflow elhasal → a GitHub e-mailt küld**, a `kephigienia.yml`-hez
hasonló módon. Ha a postafiók nem üres, a workflow **issue-t nyit**: „3 beküldés vár kézi
feldolgozásra". Ugyanez az Action a `/drain` végponttal a várakozó beküldéseket be is tudja hozni
PR-ekbe, amint a jogosultság rendben van — tehát a felhalmozódott postafiók egy kattintással
feldolgozható.

**c) Te.** A `/bekuldes/` oldalon mindig ott van az e-mail-cím mint emberi tartalék. Ha a Worker
egyáltalán nem válaszol (Cloudflare-kiesés), a form ezt észleli, és az e-mailes utat ajánlja fel
a már kitöltött adatok másolható formájával.

### Biztonság
- A beküldött szöveg soha nem kerül shell-be; a `.md`-t YAML-dumper írja; a Markdown-törzsből
  HTML-t nem engedünk (`sanitize`).
- Képek: darabszám- és bytelimit a Workerben, magic-byte típusellenőrzés, majd *mindenképp*
  szerveroldali újrakódolás az Actionben.
- A PR-t nyitó bot nem tud main-re írni (branch protection: main csak PR-ből).
- Turnstile + IP-alapú napi limit; durva spam esetén a Worker egy kapcsolóval kikapcsolható
  (KV flag), a form ilyenkor e-mail-es fallbacket mutat.
- A form Worker nélkül is működik fejlesztés közben (dry-run mód: kiírja, mit küldene).

### Mellékcsatorna: hibajelzés

Egy **egyszerű GitHub issue template** (automatizálás nélkül) a *javításokhoz*: rossz koordináta,
elírás, „ez a pad már nincs". Akinek van GitHub-fiókja, annak ez a legkényelmesebb; a többieknek
a `/bekuldes/` oldalon van egy e-mail-cím. Pad-beküldésre nem ez az út.

---

## 13. GitHub Actions workflow-k

| Fájl | Trigger | Mit tesz |
|---|---|---|
| `deploy.yml` | push `main`, napi cron 05:00 UTC, manuális | Build + Pages deploy (a cron a „nap padja" miatt) |
| `ellenorzes.yml` | `pull_request` | Zod séma, build, képlint (méret/dimenzió/EXIF), duplikátum-gyanú, Prettier |
| `bekuldes-rendbetetel.yml` | `pull_request` a `pad/*` ágakról | Kép újrakódolás, geocode, frontmatter-normalizálás, visszacommit |
| `worker-egeszseg.yml` | napi cron + manuális | Megkérdezi a Worker `/health`-ét; elhasal (= e-mail), ha a jogosultság rossz; issue-t nyit, ha beküldés vár a postafiókban. Manuálisan indítva `/drain`: a várakozókat PR-be hozza |
| `kephigienia.yml` | heti cron | Figyel: optimalizálatlan/túl nagy kép, törött hivatkozás, csak-egyszer-használt címke, átnevezett pad-könyvtár |

Öt workflow az eredeti hat helyett, és ebből kettő csak éber figyelés.

---

## 14. Képkezelés és a migráció

**M1 legelső feladata** (amíg a blogspot-képek élnek):

1. `scripts/fetch-images.mjs`: minden `img` és a `description`-ben lévő minden `<img src>`
   letöltése (retry + cache + napló: `archive/images-manifest.json`, eredeti URL → helyi fájl).
2. A blogspot `s1600` változat **már maga a maximum 1600px** → nincs értelme két példányt tartani.
   Egy példány kerül a repóba (`src/content/padok/<slug>/N.jpg`), EXIF nélkül, szükség esetén
   újrakódolva. Astro ebből generálja a WebP/AVIF változatokat build időben.
3. Innentől offline dolgozunk; a blogspot megszűnése már nem fáj.

Méretbecslés: ~500 kép × ~250 kB ≈ **125 MB** a repóban. Ez GitHub-on vállalható
(repó soft limit 1 GB). A build gyorsítására: az Astro képcache (`node_modules/.astro`)
cache-elése Actionsben — különben minden build újragenerálja az 500 kép összes változatát.

Import egyéb lépései (`scripts/import-legacy.mjs`):

- Blogger-HTML szétszedése: `<img>`-ek → `photos[]`, a maradék szöveg → tiszta Markdown
  (a `<b>2012. 03. 27.</b>` típusú dátumok → `taken` mező vagy képaláírás).
- Dátum a blog-URL-ből (`/2012/03/` → `2012-03-01`, `datePrecision: month`).
- Slug a címből, ütközésnél `-2`; `order` mező a stabil sorrendhez.
- `scripts/geocode.mjs`: Nominatim reverse geocode 1 kérés/másodperc tempóban →
  `place` szöveg + ország-címke; eredmény `archive/geocode-cache.json`-ba (egyszer fut).
- A 7 koordináta nélküli és 10 kép nélküli poszt → `archive/kezi-munka.md` lista.
- A nyers `posts (1).txt` átkerül az `archive/` alá; a `sizes.txt` törölhető.

---

## 15. Teljesítmény, SEO, jog

- Képek: `<picture>` AVIF+WebP+JPEG, `srcset`, `loading="lazy"`, megadott méretek (nincs layout shift).
- A térkép-JS **csak** a térképes nézetekben töltődik (`client:visible`).
- Cél: Lighthouse 95+, címlap < 200 kB.
- Sitemap, `robots.txt`, kanonikus URL, strukturált adat (`schema.org/Place` + `ImageObject`
  minden pad oldalán → Google kép- és térkép-találatok).
- Hozzáférhetőség: alt-szöveg (minimum a pad neve + hely), kontraszt, fókuszjelzés,
  `prefers-reduced-motion`, billentyűzetes galéria.
- Licenc: tartalom **CC BY-SA 4.0** (a beküldőtől is ezt kérjük), kód MIT.
  A `/licenc/` oldalon a beküldői nyilatkozat szövege és egy „kérem a kép törlését" eljárás.
- Kredit: a 410 archív padnál „a régi nagypad.hu csapata", beküldésnél a megadott név (vagy anonim).
- Adatvédelem: nincs süti, nincs külső betöltés a tile-szolgáltatón és a Turnstile-on kívül.
  E-mail-címet nem kérünk és nem tárolunk. A beküldő IP-je csak a Worker rate-limitjében,
  rövid ideig, hash-elve. A beküldött képről az EXIF (benne a GPS) **törlődik**, csak a
  szándékosan megadott koordináta marad.

---

## 16. Fázisok

| Fázis | Tartalom | Kimenet |
|---|---|---|
| **M0 — váz** | Repó rendbe, Astro skeleton + base path, Zod séma, 3 kézi teszt-pad, Pages deploy | Él egy URL |
| **M1 — mentés és import** ⚠️ | `fetch-images` (**ez a legsürgősebb**), `import-legacy`, `geocode`, 410 pad `.md`-ben, pad-oldal + `/padok/` lista | A teljes archívum biztonságban, böngészhető |
| **M2 — a honlap** | Térkép, címkék, keresés, címlap, dizájn, dark mode, ismeretlen-hely oldal | „Kész" honlap |
| **M3 — terjedés** | OG-képek, `/rss.xml`, napi-pad feed + cron, megosztás gombok, Zapier beállítása | Napi FB-poszt magától |
| **M4 — beküldés** | `/bekuldes/` form (EXIF, térkép, kliens-méretezés), Worker, Turnstile, rendbetevő Action | Bárki beküldhet, regisztráció nélkül |
| **M+1 — nagy címkézés** | AI-segített címke- és leírás-javaslatok batch-PR-ekben, kézi jóváhagyással | A 410 pad címkézve, a felhő megtelik |
| **M+2 — ráadás** | „Hozzám legközelebbi pad", statisztika-oldal, év-visszatekintők, márkás OG-kártya, angol verzió, OSM-be visszatöltés | |

Az M2 után érdemes megállni és élesben ránézni az anyagra — a címkerendszer alakját az M+1-ben
látott fotók fogják megmondani.

---

## 17. Teendők és maradék apróságok

### Amit neked kell egyszer elvégezned (fázis szerint)

| Mikor | Mi | Megjegyzés |
|---|---|---|
| M0 előtt | **`nagypad` GitHub szervezet** létrehozása (a név szabad), benne `nagypad.github.io` repó | A mostani repó átvihető (`Settings → Transfer`), a GitHub átirányítja a régi URL-t |
| M0 | Pages bekapcsolása (`Source: GitHub Actions`), branch protection a `main`-re | |
| M3 | **Zapier-fiók** + a Facebook Page összekötése az RSS-sel | Ingyenes tier elég |
| M4 | **Cloudflare-fiók** (Worker + KV + Turnstile, mind ingyenes tier) | |
| M4 | **GitHub App** létrehozása a szervezetben, telepítés a repóra, App ID + privát kulcs a Worker secretjébe | Ez váltja ki a lejáró tokent |

A külön szervezetnek **nincs érdemi hátránya**: publikus repónál az Actions ingyenes és korlátlan,
a Pages ugyanúgy megy, te maradsz a tulajdonos. Két apró dolog, amit érdemes tudni: a repó
átvitele után a lokális `git remote` URL-t frissíteni kell (`git remote set-url`), és a szervezeti
repókhoz a fine-grained PAT-ok extra jóváhagyást kérhetnek — ezt épp megkerüljük a GitHub Apppel.
Bónusz: ha a régi csapatból bárki szerkeszteni akar, a szervezetbe egyszerűen behívható.

### Apró eldöntendők — a megvalósítás közben, a saját javaslat szerint lezárva

1. **A honlap neve és egysoros felirata.** „Nagy Pad Projekt" + *„Padok a világ minden tájáról —
   fotók, helyszínek, történetek."* — ez van a fejlécben, az alap OG-leírásban és a feedekben.
2. **A kredit megjelenítése.** A mező ki van töltve minden archív padnál („a régi nagypad.hu
   csapata"), a megjelenítés diszkrét: apró, halvány szöveg a pad-oldal alján, a megosztás-sor
   fölött.
3. **Az ismeretlen helyű padok** (a valós importnál végül **3** lett, nem 7 — lásd lent) **nem**
   kerülnek a „nap padja" merítésbe (`napPadja()` csak a koordinátás padokból sorsol) — a
   `/ismeretlen-hely/` lista hívja fel rájuk a figyelmet.

Ha bármelyik döntés nem tetszik, mindhárom egy-egy soros változtatás (lásd
`src/layouts/Base.astro`, a pad-oldal footer-e, `src/lib/napiPad.ts`).

### Amit a valódi import az eredeti becslésekhez képest pontosított

- A 410 sorból **4 nem valódi pad** volt (a blog évfordulós/összesítő bejegyzései, szöveg és
  kép nélkül) — ezek kimaradtak. A tényleges padszám **406**.
- Ebből **3-nak** nincs koordinátája (nem 7 — a korábbi becslés a hiányzó `img` mezőt és a
  description-beli képek hiányát keverte).
- Képletöltési hiba **0 volt**, mind az 536 fotó megvan (`archive/images-manifest.json`).
- 23 egyedi ország-címke jött ki automatikusan a reverse geocode-ból.
