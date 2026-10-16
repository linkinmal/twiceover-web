/**
 * The Blog links on twiceover.io (stock-analyst-platform blog.md §1 ruling 10a/10b, #3829):
 * header "Blog" before Pricing and hidden below 640px; footer "Blog" before Terms; footer nav
 * labelled "Footer". Source-level, like header-action-controls.test.mjs.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url).pathname;
const base = readFileSync(root + "src/layouts/Base.astro", "utf8");
const css = readFileSync(root + "src/styles/site.css", "utf8");

const nav = (label) => new RegExp(`<nav class="[^"]*" aria-label="${label}">([\\s\\S]*?)</nav>`).exec(base)?.[1] ?? "";
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);

describe("Blog links", () => {
  it("puts header Blog before Pricing, tagged site-header", () => {
    expect(hrefs(nav("Primary"))).toEqual(["/blog?ref=site-header", "/pricing"]);
  });

  it("puts footer Blog after the two explainer links and right before Terms, under the label Footer", () => {
    // blog.md §1 ruling 10b: content links first (the explainers, then Blog), then the policies.
    const links = hrefs(nav("Footer"));
    expect(links.slice(0, 4)).toEqual(["/how-our-analysis-works", "/your-portfolio", "/blog?ref=site-footer", "/terms"]);
    expect(base).not.toContain("Policies and contact");
  });

  it("hides only the header Blog link below 640px, in the block that hides Sign in", () => {
    const block = /@media \(max-width: 639px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(block).toMatch(/\.site-header__signin \{ display: none; \}/);
    expect(block).toMatch(/\.site-nav a\.site-nav__blog \{ display: none; \}/);
    // Specificity matters: `.site-nav a` sets display, so a bare `.site-nav__blog` rule would lose to it.
    expect(block).not.toMatch(/(^|[\s,])\.site-nav__blog\s*[,{]/);
  });
});
