// #4503 (ADR 0993 Amendment 1): "read-only" is never a subject on /your-portfolio's connection section,
// while the app-mirroring "Schwab · read-only" stamps stay. Pinned against the page and stylesheet sources.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(root, "your-portfolio.astro"), "utf8");
const css = readFileSync(join(root, "../styles/explainer.css"), "utf8");
const from = page.indexOf('aria-labelledby="conn-h"');
const section = page.slice(from, page.indexOf('class="faq', from));

describe("the connection section (#4503)", () => {
  it("is headed 'How your broker connects' with the signed body and node captions", () => {
    expect.soft(section).toContain('<h2 id="conn-h" class="type-heading-1">How your broker connects</h2>');
    expect.soft(section).toContain("TwiceOver reads your positions, balances and open orders through SnapTrade (SOC 2 Type II). You approve the connection with your broker's own login.");
    expect.soft(section).toContain("Your broker<em>you approve, own login</em>");
    expect.soft(section).toContain("SnapTrade<em>SOC 2 Type II</em>");
    expect.soft(section).toContain("TwiceOver<em>never sees credentials</em>");
    expect.soft(section).toContain("Illustrative diagram.");
    expect.soft(section).toContain('aria-label="Your broker connects through SnapTrade to TwiceOver. You approve the connection with your broker\'s own login, and TwiceOver never sees your credentials."');
  });

  it("keeps the old heading, the arrow labels and the READS / CAN NEVER lists from returning", () => {
    expect.soft(page).not.toContain("A read-only connection");
    expect.soft(page).not.toContain('id="ro-h"');
    expect.soft(section.length).toBeGreaterThan(500);
    expect.soft(section).not.toMatch(/read-only/i);
    expect.soft(section).not.toContain("CAN NEVER");
    expect.soft(section).not.toContain("READS");
    expect.soft(section).not.toContain("xp-caps");
    expect.soft(css).not.toContain(".xp-caps");
    expect.soft(css).not.toContain(".xp-conn__foot");
  });
});

describe("the product-picture stamps (#4503)", () => {
  it("still carry 'Schwab · read-only', matching the app's Portfolio and Position headers", () => {
    expect(page.match(/\{(?:SYNC|CC)\.broker\} · read-only/g)?.length).toBe(2);
  });
});
