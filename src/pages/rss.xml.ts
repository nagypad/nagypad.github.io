import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getImage } from "astro:assets";
import { mindenPad, borito } from "../lib/padok";
import { egyszeruMarkdownHtml } from "../lib/egyszeruMarkdown";

/**
 * A legfrissebb 20 pad — ide köthető bármilyen automatizálás (Zapier, Make,
 * IFTTT), lásd TERV.md 11. fejezet. Minden itemben teljes leírás, kép
 * (`enclosure` ÉS `media:content`, hogy minél több eszköz tudjon vele mit
 * kezdeni) és `georss:point`, ha van koordináta.
 */
export async function GET({ site }: APIContext) {
  const padok = (await mindenPad()).slice(0, 20);

  const items = await Promise.all(
    padok.map(async (pad) => {
      const kep = await getImage({
        src: borito(pad).src,
        width: 1200,
        height: 800,
      });
      const kepUrl = new URL(kep.src, site).toString();
      const georss = pad.data.coords
        ? `<georss:point>${pad.data.coords[0]} ${pad.data.coords[1]}</georss:point>`
        : "";

      return {
        title: pad.data.title,
        link: `/pad/${pad.id}/`,
        pubDate: pad.data.date,
        description: pad.data.place ?? "ismeretlen hely",
        content: egyszeruMarkdownHtml(pad.body ?? ""),
        categories: pad.data.tags,
        enclosure: {
          url: kepUrl,
          // Becsült méret: a tényleges fájl mérete a build folyamat ezen
          // pontján még nem biztos, hogy ki van írva a diskre — a legtöbb
          // feed-olvasó (Zapier, Make, IFTTT) amúgy is csak az URL-t és a
          // típust használja, nem a pontos bájtszámot.
          length: 200_000,
          type: "image/avif",
        },
        customData: `<media:content url="${kepUrl}" medium="image" />${georss}`,
      };
    }),
  );

  return rss({
    title: "Nagy Pad Projekt — legfrissebb padok",
    description:
      "Padok a világ minden tájáról — a legfrissebben felkerült padok.",
    site: site!,
    items,
    xmlns: {
      media: "http://search.yahoo.com/mrss/",
      georss: "http://www.georss.org/georss",
    },
  });
}
