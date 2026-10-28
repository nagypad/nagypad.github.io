import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getImage } from "astro:assets";
import { mindenPad, borito } from "../../lib/padok";
import { napPadja } from "../../lib/napiPad";
import { egyszeruMarkdownHtml } from "../../lib/egyszeruMarkdown";
import { toIsoDate } from "../../lib/date";

/**
 * "A nap padja" feed — ebből posztol a Zapier naponta a Facebook Page-re
 * (lásd TERV.md 11. fejezet). Szándékosan EGY itemes feed: a mai pad
 * linkje minden nap más (amíg a teljes kör nem fordul), így a Zapier RSS
 * triggere mindig új elemnek látja. A `guid` a mai dátumra épül, NEM a pad
 * saját URL-jére — különben egy teljes kör letelte után, amikor egy pad
 * megint sorra kerül, a Zapier a már egyszer látott guid miatt kihagyná.
 */
export async function GET({ site }: APIContext) {
  const padok = await mindenPad();
  const maiPad = napPadja(padok);
  const nap = toIsoDate(new Date());

  const kep = await getImage({
    src: borito(maiPad).src,
    width: 1200,
    height: 800,
  });
  const kepUrl = new URL(kep.src, site).toString();

  return rss({
    title: "Nagy Pad Projekt — a nap padja",
    description: "Naponta egy pad a teljes gyűjteményből.",
    site: site!,
    items: [
      {
        title: `A nap padja: ${maiPad.data.title}`,
        link: `/pad/${maiPad.id}/`,
        pubDate: new Date(),
        description: maiPad.data.place ?? "ismeretlen hely",
        content: egyszeruMarkdownHtml(maiPad.body ?? ""),
        categories: maiPad.data.tags,
        enclosure: { url: kepUrl, length: 200_000, type: "image/avif" },
        customData: `<guid isPermaLink="false">napi-pad-${nap}</guid><media:content url="${kepUrl}" medium="image" />`,
      },
    ],
    xmlns: { media: "http://search.yahoo.com/mrss/" },
  });
}
