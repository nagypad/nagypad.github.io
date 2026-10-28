/**
 * Nagyon egyszerű Markdown→HTML: a padok leírása szándékosan rövid, sima
 * szöveg (lásd TERV.md 2. fejezet — a leírások többsége pár soros vagy
 * üres), ezért a feedekhez nem indítunk teljes remark/rehype láncot, csak
 * bekezdésekre bontunk és HTML-escape-elünk. Ha egyszer valaki linket vagy
 * félkövér szöveget ír egy leírásba, az itt szó szerint jelenik meg —
 * elfogadható egyszerűsítés a feed-kontextusban.
 */
export function egyszeruMarkdownHtml(markdown: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return markdown
    .trim()
    .split(/\n{2,}/)
    .filter((bekezdes) => bekezdes.trim().length > 0)
    .map(
      (bekezdes) =>
        `<p>${escape(bekezdes.trim()).replace(/\n/g, "<br />")}</p>`,
    )
    .join("\n");
}
