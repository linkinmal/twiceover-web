import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { remarkNoHtml } from "./src/blog/remark-no-html.mjs";
import { blogContentDir } from "./src/blog/content-dir.mjs";
import { readPostTimes, sitemapSerialize } from "./src/blog/sitemap.mjs";

// Static output; pages build as <path>/index.html so Cloudflare Workers Static
// Assets serves each route at its clean per-path URL (#39 AC1/AC6).
export default defineConfig({
  site: "https://twiceover.io",
  trailingSlash: "never",
  // A blog post is Markdown only: raw HTML in one fails the build (ADR 1090 Decision 11).
  markdown: { remarkPlugins: [remarkNoHtml] },
  // /in-app/* are the iOS app's chromeless legal copies (stock-analyst-platform#4033) —
  // noindex, and the full /terms, /privacy and /cookies stay the pages search finds.
  // A post's <lastmod> is its true last-changed date (updatedAt, else publishAt) — ADR 1090 Decision 7.
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith("/in-app/"),
      serialize: sitemapSerialize(readPostTimes(blogContentDir(process.env))),
    }),
  ],
});
