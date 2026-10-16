/**
 * Base.astro's two blog-driven meta changes (ADR 1088 Decision 4): `og:locale` en_US on every page, and
 * an optional per-page share image that defaults to the rotating site card. Read from the source, as
 * `scripts/gen-og-cards.test.mjs` does for the card pointer.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = readFileSync(new URL("./Base.astro", import.meta.url), "utf8");

describe("Base.astro share metadata", () => {
  it("declares og:locale en_US for every page, matching lang en-US", () => {
    expect.soft(base).toContain('<meta property="og:locale" content="en_US" />');
    expect.soft(base).toContain('<html lang="en-US">');
  });

  it("takes an optional root-relative image that feeds both share tags, and falls back to the site card", () => {
    expect.soft(base).toMatch(/image\?: string;/);
    expect.soft(base).toContain("image ? new URL(assertShareImage(image), Astro.site).href : cardURL");
    expect.soft(base).toMatch(/og:image"\s+content=\{ogImageURL\}/);
    expect.soft(base).toMatch(/twitter:image"\s+content=\{ogImageURL\}/);
  });
});
