import type { APIRoute } from "astro";
import { getImage } from "astro:assets";
import { mindenPad, koordinaltPadok, borito } from "../lib/padok";

/**
 * A teljes padlista térképi reprezentációja. A kliens (`Terkep.astro`) ezt
 * tölti be futásidőben a klaszterezett nézethez — nem kell build-time
 * inline-olni, és bármilyen más automatizálás is felhasználhatja
 * (lásd TERV.md 6. és 11. fejezet).
 */
export const GET: APIRoute = async () => {
  const padok = koordinaltPadok(await mindenPad());

  const features = await Promise.all(
    padok.map(async (pad) => {
      const kep = await getImage({
        src: borito(pad).src,
        width: 160,
        height: 104,
      });
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [pad.data.coords![1], pad.data.coords![0]],
        },
        properties: {
          slug: pad.id,
          title: pad.data.title,
          place: pad.data.place ?? "",
          thumb: kep.src,
        },
      };
    }),
  );

  const geojson = { type: "FeatureCollection" as const, features };

  return new Response(JSON.stringify(geojson), {
    headers: { "Content-Type": "application/geo+json; charset=utf-8" },
  });
};
