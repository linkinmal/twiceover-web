import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// stock-analyst-platform#4610: the tab icon is the SVG alone. Chrome picks the 32px PNG over the SVG
// whenever both are linked (observed in dark Chrome, with and without sizes="any" on the SVG link),
// and the PNG is navy, so favicon.svg's prefers-color-scheme: dark fill never fired. The founder chose
// to drop the PNG link. favicon-32.png stays in public/ (gen-favicons writes it) but nothing links it.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const iconLinks = (src) => [...src.matchAll(/<link\b[^>]*\brel="icon"[^>]*>/g)].map((m) => m[0]);

describe("favicon links", () => {
  it.each(["src/layouts/Base.astro", "src/layouts/BlogBase.astro"])(
    "%s declares exactly one icon, the SVG, and the SVG carries its dark-scheme fill",
    (layout) => {
      const src = read(layout);
      const links = iconLinks(src);
      const svg = read("public/favicon.svg");

      expect.soft(links).toHaveLength(1);
      expect.soft(links[0]).toContain('type="image/svg+xml"');
      expect.soft(links[0]).toContain('href="/favicon.svg"');
      expect.soft(src).not.toContain("favicon-32.png");
      expect.soft(svg).toMatch(/prefers-color-scheme:\s*dark/);
    },
  );
});
