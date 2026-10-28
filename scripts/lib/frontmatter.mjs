import { readFileSync } from "node:fs";
import yaml from "js-yaml";

/**
 * Egyszerű frontmatter-kiolvasó: a `---` határolók közötti YAML-t adja vissza
 * objektumként. Nem Astro-futtatási környezetben (sima Node-szkriptekben)
 * használjuk, ahol nem akarunk teljes Astro content-collection motort indítani
 * csak egy mező kiolvasásáért.
 */
export function olvassFrontmattert(fajlUtvonal) {
  const nyers = readFileSync(fajlUtvonal, "utf-8");
  const match = nyers.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Nincs frontmatter: ${fajlUtvonal}`);
  }
  return yaml.load(match[1]) ?? {};
}
