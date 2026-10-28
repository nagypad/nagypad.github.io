/**
 * GitHub App hitelesítés — SZÁNDÉKOSAN nem lejáró személyes tokent (PAT)
 * használunk (lásd TERV.md 12. fejezet "Jogosultság" rész): a Worker minden
 * híváskor magának vált egy max. 1 órás installation tokent egy App
 * privát kulccsal aláírt JWT-ből. Így nincs olyan titok, ami egy nap
 * csendben lejár.
 */

/** PEM (PKCS#1 vagy PKCS#8) privát kulcs importálása Web Crypto `CryptoKey`-vé. */
async function privatKulcsImportalasa(pem: string): Promise<CryptoKey> {
  const tisztitott = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(tisztitott), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64Url(adat: ArrayBuffer | string): string {
  const bytes = typeof adat === "string" ? new TextEncoder().encode(adat) : new Uint8Array(adat);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Rövid életű (max 10 perc) JWT a GitHub App nevében, a GitHub docs szerint. */
async function appJwt(appId: string, privateKeyPem: string): Promise<string> {
  const most = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ iat: most - 60, exp: most + 9 * 60, iss: appId }),
  );
  const kulcs = await privatKulcsImportalasa(privateKeyPem);
  const alairas = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    kulcs,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64Url(alairas)}`;
}

export interface GithubAppCredentials {
  appId: string;
  privateKeyPem: string;
  installationId: string;
}

/**
 * Egy friss (≤1 órás) installation access tokent ad vissza, amivel a
 * `github.ts` a tényleges repó-műveleteket (blob/tree/commit/PR) végzi.
 * Nincs cache-elve — a Worker egy kérés-válasz ciklusa rövid, nem éri meg
 * a bonyolítást egy KV-alapú token-cache-sel.
 */
export async function installationToken(hitelesites: GithubAppCredentials): Promise<string> {
  const jwt = await appJwt(hitelesites.appId, hitelesites.privateKeyPem);

  const valasz = await fetch(
    `https://api.github.com/app/installations/${hitelesites.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "nagypad-bekuldes-worker",
      },
    },
  );

  if (!valasz.ok) {
    throw new Error(`GitHub App token hiba: HTTP ${valasz.status} — ${await valasz.text()}`);
  }

  const adat = (await valasz.json()) as { token: string };
  return adat.token;
}
