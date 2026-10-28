import type { APIRoute } from "astro";
import { getImage } from "astro:assets";
import { mindenPad, borito } from "../lib/padok";

/**
 * A teljes padlista géppel olvasható formában — bármilyen automatizáláshoz
 * (lásd TERV.md 1. és 11. fejezet: "az adat kimenthető").
 */
export const GET: APIRoute = async ({ site }) => {
  const padok = await mindenPad();

  const adat = await Promise.all(
    padok.map(async (pad) => {
      const kep = await getImage({ src: borito(pad).src, width: 640 });
      return {
        slug: pad.id,
        title: pad.data.title,
        date: pad.data.date.toISOString().slice(0, 10),
        coords: pad.data.coords ?? null,
        place: pad.data.place ?? null,
        tags: pad.data.tags,
        credit: pad.data.credit ?? null,
        cover: new URL(kep.src, site).toString(),
        url: new URL(`/pad/${pad.id}/`, site).toString(),
      };
    }),
  );

  return new Response(JSON.stringify(adat, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
