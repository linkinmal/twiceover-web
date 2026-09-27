import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Static output; pages build as <path>/index.html so Cloudflare Workers Static
// Assets serves each route at its clean per-path URL (#39 AC1/AC6).
export default defineConfig({
  site: "https://twiceover.io",
  trailingSlash: "never",
  // /in-app/* are the iOS app's chromeless legal copies (stock-analyst-platform#4033) —
  // noindex, and the full /terms, /privacy and /cookies stay the pages search finds.
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith("/in-app/") })],
});
