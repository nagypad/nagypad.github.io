/**
 * A GitHub Git Data API-val építi fel a commitot: blob-ok → fa → commit →
 * új branch → pull request. Ez a réteg SOHA nem ír a `main`-re — mindig
 * egy `pad/<slug>-<hash>` ágra commitol, és onnan nyit PR-t (lásd
 * TERV.md 12. fejezet).
 */

export interface GithubKontextus {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
}

async function githubFetch<T = Record<string, any>>(
  kontextus: GithubKontextus,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const valasz = await fetch(`https://api.github.com/repos/${kontextus.owner}/${kontextus.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${kontextus.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "nagypad-bekuldes-worker",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!valasz.ok) {
    throw new Error(`GitHub API hiba (${path}): HTTP ${valasz.status} — ${await valasz.text()}`);
  }
  return (await valasz.json()) as T;
}

export interface UjFajl {
  /** Repón belüli útvonal, pl. "src/content/padok/pelda-pad/index.md" */
  path: string;
  /** Szöveges tartalom (frontmatter+leírás) VAGY base64 (képeknél) */
  content: string;
  encoding: "utf-8" | "base64";
}

/**
 * Létrehoz egy új branch-et a `baseBranch` tetejéről, rá egy commitot az
 * adott fájlokkal, majd egy pull requestet a `baseBranch` felé.
 * Visszaadja a PR URL-jét és számát.
 */
export async function ujPadPrLetrehozasa(
  kontextus: GithubKontextus,
  opciok: { branch: string; commitUzenet: string; prCim: string; prLeiras: string; fajlok: UjFajl[] },
): Promise<{ prUrl: string; prSzam: number }> {
  const alapRef = await githubFetch(kontextus, `/git/ref/heads/${kontextus.baseBranch}`);
  const alapCommitSha = alapRef.object.sha as string;

  const alapCommit = await githubFetch(kontextus, `/git/commits/${alapCommitSha}`);
  const alapFaSha = alapCommit.tree.sha as string;

  const faBejegyzesek = [];
  for (const fajl of opciok.fajlok) {
    const blob = await githubFetch(kontextus, "/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: fajl.content, encoding: fajl.encoding }),
    });
    faBejegyzesek.push({ path: fajl.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const ujFa = await githubFetch(kontextus, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: alapFaSha, tree: faBejegyzesek }),
  });

  const ujCommit = await githubFetch(kontextus, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: opciok.commitUzenet,
      tree: ujFa.sha,
      parents: [alapCommitSha],
    }),
  });

  await githubFetch(kontextus, "/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${opciok.branch}`, sha: ujCommit.sha }),
  });

  const pr = await githubFetch(kontextus, "/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: opciok.prCim,
      body: opciok.prLeiras,
      head: opciok.branch,
      base: kontextus.baseBranch,
    }),
  });

  return { prUrl: pr.html_url, prSzam: pr.number };
}

/** Egyszerű, olcsó hívás az `/health` végponthoz: csak azt nézi, érvényes-e a token. */
export async function githubElerhetosegTeszt(kontextus: GithubKontextus): Promise<boolean> {
  try {
    await githubFetch(kontextus, "");
    return true;
  } catch {
    return false;
  }
}
