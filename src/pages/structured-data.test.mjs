// Source-level regression coverage for the JSON-LD structured-data gaps found in the SEO re-audit
// (stock-analyst-platform#2634) — no DOM parser dependency in this repo's tooling, so this asserts
// against the .astro source text directly, the same style faq-structure.test.mjs uses. Scenario-grain:
// one Given/When per test, every promised facet soft-asserted together (conventions.md §Testing,
// ADR 0062).

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
      .soft(block, "sameAs links the X account and the YouTube channel")
      .toMatch(
        /sameAs:\s*\[\s*"https:\/\/x\.com\/twiceover_io"\s*,\s*"https:\/\/www\.youtube\.com\/@twiceover-io"\s*\]/,
      );
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
    // Premium joins with its card (stock-analyst-platform#3829, ADR 0912 Amendment 1).
    const premiumOffer = offers.match(/{[^}]*name:\s*"Premium"[^}]*}/)?.[0];
    expect.soft(freeOffer, "Free offer present").toBeTruthy();
    expect.soft(coreOffer, "Core offer present").toBeTruthy();
    expect.soft(premiumOffer, "Premium offer present").toBeTruthy();
    expect.soft(premiumOffer, "Premium at its Accepted price").toMatch(/price:\s*"99"/);

    for (const [offer, label] of [
      [freeOffer, "Free"],
      [coreOffer, "Core"],
      [premiumOffer, "Premium"],
    ]) {
      expect
        .soft(offer, `${label} offer declares availability`)
        .toMatch(/availability:\s*"https:\/\/schema\.org\/InStock"/);
      expect
        .soft(offer, `${label} offer declares its own url`)
        .toMatch(/url:\s*"https:\/\/twiceover\.io\/go\/[\w-]+"/);
    }
  });
});

// stock-analyst-platform#4156 — Search Console Merchant listings: image (critical), description and
// brand (non-critical) missing from the Product block.
describe("stock-analyst-platform#4156 — pricing Product JSON-LD image, description, brand", () => {
  it("points image at an existing brand card by its own file name", () => {
    const block = jsonLdBlock(pricingAstro, "productJsonLd");
    const image = block.match(/image:\s*"(https:\/\/twiceover\.io\/(og-card-[\w-]+\.png))"/);

    expect.soft(image, "image is an absolute URL of an og-card file").toBeTruthy();
    expect
      .soft(existsSync(join(root, "../../public", image?.[2] ?? "missing")), "the card file exists")
      .toBe(true);
    expect
      .soft(block, "not the rotating OG_CARD pointer")
      .not.toMatch(/image:\s*(OG_CARD|ogImageURL)/);
  });

  it("derives description from the same const as the Base description prop", () => {
    const block = jsonLdBlock(pricingAstro, "productJsonLd");
    const literal =
      "One simple monthly subscription. No per-analysis charges. Use it with or without a broker connection.";

    expect
      .soft(pricingAstro.replace(/\s+/g, " "))
      .toContain(`const pricingDescription = "${literal}";`);
    expect.soft(block, "Product description reads the const").toMatch(/description:\s*pricingDescription,/);
    expect
      .soft(pricingAstro, "Base description reads the same const")
      .toMatch(/<Base[^>]*description=\{pricingDescription\}/);
  });

  it("declares the brand as a TwiceOver Brand", () => {
    const block = jsonLdBlock(pricingAstro, "productJsonLd");
    expect
      .soft(block)
      .toMatch(/brand:\s*{\s*"@type":\s*"Brand",\s*name:\s*"TwiceOver",?\s*}/);
  });
});
