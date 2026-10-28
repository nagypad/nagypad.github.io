import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Egy pad = `src/content/padok/<slug>/index.md` + mellette a fotók.
 *
 * A könyvtár neve a slug, és az a slug az URL is (`/pad/<slug>/`) — nincs rá
 * külön frontmatter mező. A `glob` loader az `index.md` végű útvonalakból
 * automatikusan a könyvtárnevet adja `id`-nak (lásd TERV.md 4. fejezet).
 *
 * A mezők minimálisra csupaszítva: csak `title`, `date` és `photos` kötelező.
 */
const padok = defineCollection({
  loader: glob({ pattern: "**/index.md", base: "./src/content/padok" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1, "Hiányzik a pad neve").max(120),

      // Közzététel dátuma. A régi posztoknál csak év-hónap ismert a blog
      // URL-jéből, ezért ott a dátum a hónap elseje — a megjelenítésnél
      // mindig "2012. március" formában írjuk ki, soha napra pontosan nem
      // állítjuk, így nem kell külön datePrecision mező.
      date: z.coerce.date(),

      // [lat, lon]. Elhagyható → a pad az "ismeretlen hely" listába kerül.
      coords: z
        .tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])
        .optional(),

      // Egyetlen szabadszöveges mező, nincs ország/város/régió hierarchia.
      // A geocode csak kitölti importkor/beküldésnél, utána szabadon írható.
      place: z.string().max(200).optional(),

      // Szabad címkézés, nincs kötelező szótár (lásd src/data/cimkek-alap.yml
      // és src/data/cimke-aliasok.yml).
      tags: z.array(z.string().min(1).max(40)).default([]),

      // A galéria. A borító MINDIG az első elem — nincs külön cover mező.
      photos: z
        .array(
          z.object({
            src: image(),
            caption: z.string().max(300).optional(),
          }),
        )
        .min(1, "Legalább egy fotó kötelező"),

      // Ki fotózta / küldte be. A régi archívumnál mindig ugyanaz a szöveg.
      credit: z.string().max(160).optional(),

      // Csak nyomkövetésre a régi blogbejegyzéshez, nem linkeljük ki.
      legacyUrl: z.string().url().optional(),
    }),
});

export const collections = { padok };
