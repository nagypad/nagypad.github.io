import type { APIRoute } from "astro";
import { mindenPad } from "../lib/padok";

/** Csak a slugek, a `/veletlen/` oldal kliensoldali sorsolásához. */
export const GET: APIRoute = async () => {
  const padok = await mindenPad();
  const slugek = padok.map((p) => p.id);
  return new Response(JSON.stringify(slugek), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
