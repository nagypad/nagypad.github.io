/**
 * A beküldött JSON ellenőrzése. A kliens (src/pages/bekuldes/index.astro)
 * már végez egy könnyű validációt, de a Workerben MINDENT újra ellenőrzünk
 * — a kliensnek sosem bízunk meg (bárki küldhet ide közvetlen POST-ot is).
 */

export class ValidacioHiba extends Error {}

export interface TisztaBekuldes {
  title: string;
  place: string | null;
  coords: [number, number] | null;
  description: string;
  taken: string | null;
  tags: string[];
  credit: string;
  photos: string[]; // data: URL-ek
}

const MAX_FOTO = 4;
const MAX_FOTO_BYTE = 8 * 1024 * 1024;
const MAX_TAG = 15;

function dataUrlByteHossz(dataUrl: string): number {
  const vesszo = dataUrl.indexOf(",");
  if (vesszo === -1) return 0;
  // base64: 4 karakter ≈ 3 bájt
  return Math.floor(((dataUrl.length - vesszo - 1) * 3) / 4);
}

export function bekuldesValidalasa(nyers: unknown): TisztaBekuldes {
  if (typeof nyers !== "object" || nyers === null) {
    throw new ValidacioHiba("Hiányzó vagy hibás kérés-törzs.");
  }
  const b = nyers as Record<string, unknown>;

  const title = String(b.title ?? "").trim();
  if (title.length < 2 || title.length > 120) {
    throw new ValidacioHiba("A pad nevének 2 és 120 karakter között kell lennie.");
  }

  const credit = String(b.credit ?? "").trim();
  if (credit.length < 1 || credit.length > 80) {
    throw new ValidacioHiba("Add meg, ki küldte be (vagy írd: anonim).");
  }

  if (b.consent !== true) {
    throw new ValidacioHiba("A licenc-nyilatkozat elfogadása kötelező.");
  }

  let coords: [number, number] | null = null;
  if (b.coords !== null && b.coords !== undefined) {
    if (
      !Array.isArray(b.coords) ||
      b.coords.length !== 2 ||
      typeof b.coords[0] !== "number" ||
      typeof b.coords[1] !== "number" ||
      Math.abs(b.coords[0]) > 90 ||
      Math.abs(b.coords[1]) > 180
    ) {
      throw new ValidacioHiba("Érvénytelen koordináta.");
    }
    coords = [b.coords[0], b.coords[1]];
  }

  const place = b.place ? String(b.place).trim().slice(0, 200) : null;
  const description = b.description ? String(b.description).trim().slice(0, 800) : "";
  const taken =
    b.taken && /^\d{4}(-\d{2})?$/.test(String(b.taken).trim()) ? String(b.taken).trim() : null;

  const tags = Array.isArray(b.tags)
    ? b.tags
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40)
        .slice(0, MAX_TAG)
    : [];

  if (!Array.isArray(b.photos) || b.photos.length === 0 || b.photos.length > MAX_FOTO) {
    throw new ValidacioHiba(`1 és ${MAX_FOTO} közötti fotót kell beküldeni.`);
  }
  for (const foto of b.photos) {
    if (typeof foto !== "string" || !foto.startsWith("data:image/")) {
      throw new ValidacioHiba("Érvénytelen fotóformátum.");
    }
    if (dataUrlByteHossz(foto) > MAX_FOTO_BYTE) {
      throw new ValidacioHiba("Egy fotó túl nagy (max. 8 MB).");
    }
  }

  return {
    title,
    place,
    coords,
    description,
    taken,
    tags,
    credit,
    photos: b.photos as string[],
  };
}

export async function turnstileEllenorzes(
  token: string | null,
  secretKey: string,
  remoteIp: string | null,
): Promise<boolean> {
  if (!token) return false;
  const form = new FormData();
  form.set("secret", secretKey);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const valasz = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const adat = (await valasz.json()) as { success: boolean };
  return adat.success === true;
}
