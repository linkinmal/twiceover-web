// Source-level regression coverage for the JSON-LD structured-data gaps found in the SEO re-audit
// (stock-analyst-platform#2634) — no DOM parser dependency in this repo's tooling, so this asserts
// against the .astro source text directly, the same style faq-structure.test.mjs uses. Scenario-grain:
// one Given/When per test, every promised facet soft-asserted together (conventions.md §Testing,
// ADR 0062).

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
let indexAstro;
let pricingAstro;

beforeAll(() => {
  indexAstro = readFileSync(join(root, "index.astro"), "utf8");
  pricingAstro = readFileSync(join(root, "pricing.astro"), "utf8");
});

function jsonLdBlock(source, constName) {
  const start = source.indexOf(`const ${constName} = {`);
  if (start === -1) throw new Error(`${constName} not found`);
  const end = source.indexOf("\n};", start);
  if (end === -1) throw new Error(`${constName} block has no closing };`);
  return source.slice(start, end + 3);
}

describe("stock-analyst-platform#2634 — Organization JSON-LD sameAs/logo (index.astro)", () => {
  it("links the X account and a brand asset alongside the existing identity fields", () => {
    const block = jsonLdBlock(indexAstro, "organizationJsonLd");

    expect
      .soft(block, "email field kept, not replaced")
      .toContain('email: "support@twiceover.io"');
    expect
      .soft(block, "sameAs links the X account")
      .toMatch(/sameAs:\s*\[\s*"https:\/\/x\.com\/twiceover_io"\s*\]/);
    expect
      .soft(block, "logo points at an absolute brand-asset URL")
      .toMatch(/logo:\s*"https:\/\/twiceover\.io\/[\w.-]+"/);
  });
});

describe("stock-analyst-platform#2634 — pricing Product JSON-LD (pricing.astro)", () => {
  it("declares the canonical pricing URL with no trailing slash", () => {
    const block = jsonLdBlock(pricingAstro, "productJsonLd");
    expect.soft(block).toContain('url: "https://twiceover.io/pricing"');
    expect
      .soft(block, "no 307-redirecting trailing slash")
      .not.toMatch(/url:\s*"https:\/\/twiceover\.io\/pricing\/"/);
  });

  it("gives every offer its own availability and URL", () => {
    const block = jsonLdBlock(pricingAstro, "productJsonLd");
    const offersStart = block.indexOf("offers: [");
    const offers = block.slice(offersStart);

    const freeOffer = offers.match(/{[^}]*name:\s*"Free"[^}]*}/)?.[0];
    const coreOffer = offers.match(/{[^}]*name:\s*"Core"[^}]*}/)?.[0];
    expect.soft(freeOffer, "Free offer present").toBeTruthy();
    expect.soft(coreOffer, "Core offer present").toBeTruthy();

    for (const [offer, label] of [
      [freeOffer, "Free"],
      [coreOffer, "Core"],
    ]) {
      expect
        .soft(offer, `${label} offer declares availability`)
        .toMatch(/availability:\s*"https:\/\/schema\.org\/InStock"/);
      expect
        .soft(offer, `${label} offer declares its own url`)
        .toMatch(/url:\s*"https:\/\/twiceover\.io\/go\/\w+"/);
    }
  });
});
