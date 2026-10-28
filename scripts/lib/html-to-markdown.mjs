import * as cheerio from "cheerio";

const BLOKK_ELEMEK = new Set([
  "div",
  "p",
  "table",
  "tbody",
  "tr",
  "td",
  "blockquote",
  "ul",
  "li",
]);

/**
 * A Blogger-export `description` HTML-jének nagyon célzott, nem általános
 * HTML→Markdown átalakítója. NEM próbál minden HTML-t kezelni — csak azt a
 * pár taget, ami a régi nagypad.hu posztjaiban tényleg előfordul (ellenőrizve
 * a teljes exporton): div, a, br, img, span, b, table/tr/td, blockquote,
 * iframe (YouTube-beágyazás). Lásd TERV.md 14. fejezet.
 *
 * A képeket (és a kizárólag képet tartalmazó <a> linkeket) a hívó már
 * korábban külön kiszedte (lásd `kepCimkekKigyujtese`) — ez a függvény a
 * MARADÉK leíró szöveget alakítja Markdownná.
 */
export function leirasMarkdownKent(html) {
  const $ = cheerio.load(html ?? "", null, false);

  $("img").remove();
  $("iframe").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    $(el).replaceWith(`\n\n[Beágyazott videó](${src})\n\n`);
  });

  function soros(el) {
    if (el.type === "text") {
      return el.data.replace(/ /g, " ");
    }
    if (el.type !== "tag") return "";

    const $el = $(el);
    const belsoSzoveg = () =>
      $el
        .contents()
        .map((_, c) => soros(c))
        .get()
        .join("");

    switch (el.name) {
      case "br":
        return "\n";
      case "b":
      case "strong": {
        const t = belsoSzoveg().trim();
        return t ? `**${t}**` : "";
      }
      case "i":
      case "em": {
        const t = belsoSzoveg().trim();
        return t ? `*${t}*` : "";
      }
      case "a": {
        const t = belsoSzoveg().trim();
        const href = $el.attr("href");
        if (!t) return "";
        return href ? `[${t}](${href})` : t;
      }
      default:
        if (BLOKK_ELEMEK.has(el.name)) {
          const t = belsoSzoveg();
          return t.trim() ? `\n\n${t}\n\n` : "";
        }
        return belsoSzoveg();
    }
  }

  const nyers = $.root()
    .contents()
    .map((_, c) => soros(c))
    .get()
    .join("");

  return nyers
    .split("\n")
    .map((sor) => sor.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
