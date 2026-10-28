/**
 * A beküldés-fogadó Cloudflare Worker (lásd TERV.md 12. fejezet).
 *
 * Végpontok:
 *  - POST /          — új pad beküldése a `/bekuldes/` formról. Sikeres
 *                      validáció után egyenesen egy kész pull requestet
 *                      nyit (nincs issue-réteg).
 *  - GET  /health     — a `worker-egeszseg.yml` Action hívja naponta:
 *                      visszaadja, működik-e a GitHub-jogosultság, és hány
 *                      beküldés várakozik a KV-"postafiókban".
 *  - POST /drain      — (titkos fejjel védve) a várakozó postafiók-
 *                      bejegyzéseket próbálja újra PR-ré alakítani.
 *
 * ÁLLAPOT: ez a kód még nincs élesben kipróbálva — a Cloudflare-fiók és a
 * GitHub App a TERV.md 17. fejezet szerinti teendő. Helyi teszteléshez:
 * `cd worker && npm install && cp .dev.vars.example .dev.vars` (töltsd ki),
 * majd `npm run dev`.
 */
import { installationToken, type GithubAppCredentials } from "./githubApp";
import { ujPadPrLetrehozasa, githubElerhetosegTeszt, type GithubKontextus, type UjFajl } from "./github";
import { bekuldesValidalasa, turnstileEllenorzes, ValidacioHiba, type TisztaBekuldes } from "./validate";
import { slugify } from "./slug";
import yaml from "js-yaml";

export interface Env {
  RATE_LIMIT: KVNamespace;
  POSTAFIOK: KVNamespace;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BASE_BRANCH: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_APP_INSTALLATION_ID: string;
  TURNSTILE_SECRET_KEY: string;
  EGESZSEG_TITOK: string; // a worker-egeszseg.yml ezzel azonosítja magát /drain-nél
  ENGEDELYEZETT_SZARMAZAS?: string; // CORS — pl. "https://nagypad.github.io"
}

const NAPI_LIMIT = 5;

function corsFejek(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ENGEDELYEZETT_SZARMAZAS ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Egeszseg-Titok",
  };
}

function valasz(adat: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(adat), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(env ? corsFejek(env) : {}) },
  });
}

async function ipHash(ip: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function rateLimitAtlepve(env: Env, ip: string): Promise<boolean> {
  const kulcs = `rate:${await ipHash(ip)}:${new Date().toISOString().slice(0, 10)}`;
  const jelenlegi = Number((await env.RATE_LIMIT.get(kulcs)) ?? "0");
  if (jelenlegi >= NAPI_LIMIT) return true;
  await env.RATE_LIMIT.put(kulcs, String(jelenlegi + 1), { expirationTtl: 60 * 60 * 24 * 2 });
  return false;
}

function githubHitelesites(env: Env): GithubAppCredentials {
  return {
    appId: env.GITHUB_APP_ID,
    privateKeyPem: env.GITHUB_APP_PRIVATE_KEY,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
  };
}

/** A beküldésből előállítja a `index.md` tartalmát — ugyanaz a forma, mint `scripts/import-legacy.mjs`-ben. */
function indexMdTartalom(b: TisztaBekuldes): string {
  const frontmatter: Record<string, unknown> = {
    title: b.title,
    date: new Date().toISOString().slice(0, 10),
  };
  if (b.coords) frontmatter.coords = b.coords;
  if (b.place) frontmatter.place = b.place;
  frontmatter.tags = b.tags;
  frontmatter.photos = b.photos.map((_, i) => ({ src: `./${i + 1}.jpg` }));
  frontmatter.credit = b.credit;

  const yamlSzoveg = yaml.dump(frontmatter, { lineWidth: -1, quotingType: '"' });
  return `---\n${yamlSzoveg}---\n\n${b.description}\n`;
}

async function bekuldesFeldolgozasa(
  b: TisztaBekuldes,
  env: Env,
): Promise<{ prUrl: string; prSzam: number }> {
  const token = await installationToken(githubHitelesites(env));
  const kontextus: GithubKontextus = {
    token,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    baseBranch: env.GITHUB_BASE_BRANCH,
  };

  const alapSlug = slugify(b.title) || "pad";
  const rovidHash = Math.random().toString(36).slice(2, 8);
  const slug = `${alapSlug}-${rovidHash}`;
  const branch = `pad/${slug}`;

  const fajlok: UjFajl[] = [
    {
      path: `src/content/padok/${slug}/index.md`,
      content: indexMdTartalom(b),
      encoding: "utf-8",
    },
    ...b.photos.map((dataUrl, i) => ({
      path: `src/content/padok/${slug}/${i + 1}.jpg`,
      content: dataUrl.slice(dataUrl.indexOf(",") + 1),
      encoding: "base64" as const,
    })),
  ];

  return ujPadPrLetrehozasa(kontextus, {
    branch,
    commitUzenet: `Új pad: ${b.title}`,
    prCim: `Új pad: ${b.title}`,
    prLeiras: [
      `Beküldő: ${b.credit}`,
      b.place ? `Helyszín: ${b.place}` : "Helyszín: ismeretlen",
      "",
      "Ez a PR automatikusan jött létre a `/bekuldes/` formról.",
      "A `bekuldes-rendbetetel.yml` Action rövidesen újrakódolja a képeket és normalizálja a frontmattert.",
    ].join("\n"),
    fajlok,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsFejek(env) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const kontextus: GithubKontextus = {
        token: await installationToken(githubHitelesites(env)).catch(() => ""),
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        baseBranch: env.GITHUB_BASE_BRANCH,
      };
      const githubOk = kontextus.token ? await githubElerhetosegTeszt(kontextus) : false;
      const postafiokLista = await env.POSTAFIOK.list();
      return valasz(
        { githubOk, varakozoBekuldesek: postafiokLista.keys.length },
        githubOk ? 200 : 503,
        env,
      );
    }

    if (request.method === "POST" && url.pathname === "/drain") {
      if (request.headers.get("X-Egeszseg-Titok") !== env.EGESZSEG_TITOK) {
        return valasz({ uzenet: "Nincs jogosultság." }, 401, env);
      }
      const lista = await env.POSTAFIOK.list();
      const eredmenyek = [];
      for (const kulcsAdat of lista.keys) {
        const nyers = await env.POSTAFIOK.get(kulcsAdat.name);
        if (!nyers) continue;
        try {
          const b = bekuldesValidalasa(JSON.parse(nyers));
          const { prUrl } = await bekuldesFeldolgozasa(b, env);
          await env.POSTAFIOK.delete(kulcsAdat.name);
          eredmenyek.push({ kulcs: kulcsAdat.name, prUrl });
        } catch (hiba) {
          eredmenyek.push({ kulcs: kulcsAdat.name, hiba: String(hiba) });
        }
      }
      return valasz({ eredmenyek }, 200, env);
    }

    if (request.method === "POST" && url.pathname === "/") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "ismeretlen";
      if (await rateLimitAtlepve(env, ip)) {
        return valasz({ uzenet: "Túl sok beküldés mára ebből az IP-ből. Próbáld holnap." }, 429, env);
      }

      let nyersTest: unknown;
      try {
        nyersTest = await request.json();
      } catch {
        return valasz({ uzenet: "Hibás JSON." }, 400, env);
      }

      const turnstileOk = await turnstileEllenorzes(
        (nyersTest as Record<string, unknown>)?.turnstileToken as string | null,
        env.TURNSTILE_SECRET_KEY,
        ip,
      );
      if (!turnstileOk) {
        return valasz({ uzenet: "A robot-ellenőrzés nem sikerült, próbáld újra." }, 400, env);
      }

      let b: TisztaBekuldes;
      try {
        b = bekuldesValidalasa(nyersTest);
      } catch (hiba) {
        if (hiba instanceof ValidacioHiba) {
          return valasz({ uzenet: hiba.message }, 400, env);
        }
        throw hiba;
      }

      try {
        const { prUrl, prSzam } = await bekuldesFeldolgozasa(b, env);
        return valasz({ prUrl, prSzam }, 201, env);
      } catch (hiba) {
        // A GitHub felé elakadt valami (pl. lejárt/hibás App-telepítés) —
        // a beküldés a postafiókba kerül, NEM veszik el. Lásd TERV.md 12.
        const kulcs = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await env.POSTAFIOK.put(kulcs, JSON.stringify(b));
        console.error("GitHub hiba, postafiókba került:", hiba);
        return valasz(
          {
            uzenet:
              "Megkaptuk a padot, de most kézi feldolgozás alatt van — nem veszett el. " +
              "Ha pár napon belül nem jelenik meg, írj nekünk.",
          },
          202,
          env,
        );
      }
    }

    return valasz({ uzenet: "Nincs ilyen végpont." }, 404, env);
  },
};
