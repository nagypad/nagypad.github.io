import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// A honlap a `nagypad` GitHub szervezet `nagypad.github.io` repójaként él,
// ezért gyökér-útvonalon fut (nincs base path). Ha egyszer lesz saját domain,
// csak ezt az egy URL-t kell majd átírni.
export default defineConfig({
  site: "https://nagypad.github.io",
  integrations: [sitemap()],
  image: {
    // A build 400+ fotót dolgoz fel (webp/avif + srcset); a Sharp a leggyorsabb
    // és legjobb minőségű választás ehhez a mennyiséghez.
    service: {
      entrypoint: "astro/assets/services/sharp",
    },
  },
  build: {
    format: "directory",
  },
});
