import { readFileSync } from "node:fs";

/**
 * Beolvassa a régi blog TSV-exportját (`archive/posts-export.txt`).
 * Oszlopok: lat, lon, title, img, url, icon, iconSize, iconOffset,
 * description, imgwidth, imgheight — az utolsó négy a régi térkép-widget
 * maradványa, nem használjuk (lásd TERV.md 2. fejezet).
 */
export function olvassPostsExport(fajlUtvonal) {
  const nyers = readFileSync(fajlUtvonal, "utf-8");
  const sorok = nyers.split("\n").filter((s) => s.length > 0);
  const fejsor = sorok[0].split("\t");

  return sorok.slice(1).map((sor, index) => {
    const mezok = sor.split("\t");
    const rekord = { sorszam: index };
    fejsor.forEach((nev, i) => {
      rekord[nev] = mezok[i] ?? "";
    });
    return rekord;
  });
}
