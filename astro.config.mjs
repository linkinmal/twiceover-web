import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Static output; pages build as <path>/index.html so Cloudflare Workers Static
// Assets serves each route at its clean per-path URL (#39 AC1/AC6).
export default defineConfig({
  site: "https://twiceover.io",
  integrations: [sitemap()],
});
