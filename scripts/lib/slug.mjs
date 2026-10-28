const HU_TRANSLIT = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ö: "o",
  ő: "o",
  ú: "u",
  ü: "u",
  ű: "u",
};

/** Kisbetűs, ékezet- és írásjel-mentes, kötőjeles slug egy padhoz/címkéhez. */
export function slugify(szoveg) {
  return szoveg
    .toLowerCase()
    .replace(/[áéíóöőúüű]/g, (ch) => HU_TRANSLIT[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Ütközésmentes slug-képzés: ha a kiindulási slug már foglalt, `-2`, `-3`
 * stb. kerül a végére, amíg szabad változatot nem talál.
 */
export function egyediSlug(alapSlug, foglaltSlugek) {
  let slug = alapSlug || "pad";
  let szamlalo = 2;
  while (foglaltSlugek.has(slug)) {
    slug = `${alapSlug || "pad"}-${szamlalo}`;
    szamlalo++;
  }
  foglaltSlugek.add(slug);
  return slug;
}
