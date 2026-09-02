/**
 * The Pricing strip and the Closing band's trial-disclosure copy (stock-analyst-platform#3030,
 * realizing #2812 bullets 2/3; site-prelaunch.md §2 "Pricing strip" and "Closing band gains
 * trial-disclosure copy", build reference ai-team/design/assets/pricing-strip-and-closing-band-
 * trial-2026-08-28.html).
 *
 * Source-level against the .astro/.css text, the convention this repo already uses
 * (faq-structure.test.mjs, section-grounds.test.mjs) — there is no DOM parser in the build
 * pipeline. Scenario-grain: one Given/When per test, every promised facet soft-asserted
 * together (conventions.md §Testing, ADR 0062).
 *
 * The ground alternation this new section joins is NOT re-checked here — section-grounds.test.mjs
 * already resolves it from the page, so a second copy would drift rather than double-cover.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
let astro;
let pricingAstro;
let css;

beforeAll(() => {
  astro = readFileSync(join(root, "index.astro"), "utf8");
  pricingAstro = readFileSync(join(root, "pricing.astro"), "utf8");
  css = readFileSync(join(root, "..", "styles", "site.css"), "utf8");
});

/** The body of the first CSS rule whose selector is exactly `selector`, at-rules unwrapped. */
function ruleBody(selector) {
  const rules = [];
  const stack = [];
  let buf = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      const sel = stack.pop();
      if (sel !== undefined && !sel.startsWith("@")) rules.push({ selector: sel, body: buf });
      buf = "";
    } else buf += ch;
  }
  return rules.filter((r) => r.selector === selector).map((r) => r.body).join("\n");
}

/** Text content of the elements matching `class`, in document order, entities decoded. */
function textsOfClass(source, cls) {
  const re = new RegExp(`<[a-z]+[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</[a-z]+>`, "g");
  return [...source.matchAll(re)].map(([, inner]) =>
    inner
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

describe("Pricing strip (#3030, site-prelaunch.md §2 'Pricing strip')", () => {
  it("quotes /pricing's own Free and Core context lines rather than restating them", () => {
    // The spec's load-bearing constraint: both context lines are QUOTATIONS of the live /pricing
    // cards (pricing.astro), never new copy — "do not restate/paraphrase". Asserting against the
    // other surface, not against a literal pinned here, is what makes this a real drift guard:
    // it fails if EITHER page's wording moves, which a pinned string could not see.
    const captions = textsOfClass(astro, "pricing-stat__caption");
    const pricingBullets = [...pricingAstro.matchAll(/<li>([^<]*reads a month[^<]*)<\/li>/g)].map(
      ([, t]) => t.trim(),
    );

    expect(pricingBullets, "pricing.astro no longer has the two 'reads a month' bullets").toHaveLength(2);
    expect(captions).toEqual(pricingBullets);
  });

  it("carries the two price figures with the tier labels and the shared pricing link", () => {
    const strip = astro.slice(
      astro.indexOf('<section class="pricing-strip'),
      astro.indexOf("</section>", astro.indexOf('<section class="pricing-strip')),
    );

    expect(strip, "pricing-strip section not found in index.astro").not.toBe("");
    expect(textsOfClass(strip, "pricing-stat__label")).toEqual(["Free", "Core"]);
    expect(textsOfClass(strip, "pricing-stat__figure")).toEqual(["$0", "$49/mo"]);
    // One shared quiet link beneath both columns, to the full pricing page.
    expect(strip).toMatch(/<a class="btn-quiet[^"]*" href="\/pricing">See full pricing →<\/a>/);
  });

  it("sits between the Depth strip and Two doors", () => {
    // Placement is the decision this section exists for (site-prelaunch.md §2: price visible
    // before the visitor spends real scroll), so it is asserted, not left to a reader.
    const depth = astro.indexOf('<section class="depth-strip');
    const strip = astro.indexOf('<section class="pricing-strip');
    const doors = astro.indexOf('<section class="doors');

    expect(depth).toBeGreaterThan(-1);
    expect(strip).toBeGreaterThan(depth);
    expect(doors).toBeGreaterThan(strip);
  });

  it("renders the figure in the mono face with tabular numerals, not the serif display face", () => {
    // site-prelaunch.md §2: "figure in typography.display/Source Code Pro tabular numerals".
    // The Depth strip's own figure is the SERIF display face — the shared grammar is the
    // big-figure-plus-context-line shape, not the family, so this is the facet that would
    // silently regress to serif if `type-display` alone were relied on.
    const figure = ruleBody(".pricing-stat__figure");

    expect(figure).toMatch(/font-family:\s*var\(--font-family-mono\)/);
    expect(figure).toMatch(/tabular-nums/);
    expect(ruleBody(".pricing-stat__caption")).toMatch(/color:\s*var\(--color-text-secondary\)/);
  });
});

describe("Closing band trial disclosure (#3030, site-prelaunch.md §2 'Closing band gains trial-disclosure copy')", () => {
  /**
   * The canonical strings. Unlike the Pricing strip's captions above, these have no second end
   * inside THIS repo to compare against — both sources live in stock-analyst-platform
   * (ADR 0145 Amendment 7's TRIAL_DISCLOSURE_LINE_1, and trial-ux-reference.md §2). Pinned
   * literals here therefore catch an accidental edit to the shipped string, and nothing more;
   * they are not a check that the canonical source still says this.
   */
  const TRIAL_LINE =
    "Core starts with a 14-day trial. $0 due today. 14 days free. Then $49/month, plus any applicable sales tax, charged automatically to the card you save at checkout. You'll see the exact date once your trial starts.";
  const CANCEL_LINE =
    "You can cancel any time before the trial ends in Settings — one click, no charge.";
  const BODY_1 =
    "A connected free account reads your held positions in full: structure, your own rules, scenarios and paths. Free covers 10 reads a month.";
  const BODY_2 =
    "Core raises your monthly read count to 600 — a full book pass, every day. It also weighs two more inputs: the licensed news wire and curated voices, alongside price, structure, levels and fundamentals.";

  it("carries both body paragraphs and both disclosure lines verbatim, and no third disclaimer", () => {
    const band = astro.slice(astro.indexOf('<section class="closing-band"'));

    expect(textsOfClass(band, "closing-band__body")).toEqual([BODY_1, BODY_2]);
    expect(textsOfClass(band, "closing-band__disclosure")).toEqual([TRIAL_LINE, CANCEL_LINE]);
  });

  it("puts the disclosure lines beneath the buttons, in the specced order", () => {
    // The whole reason the band's ≥640px flex ROW became a column: the spec and the approved
    // mockup both place the disclosures under the button pair. Ordering is the commitment; a
    // layout change that quietly restored the row would still pass every copy assertion above.
    const band = astro.slice(astro.indexOf('<section class="closing-band"'));
    const at = (needle) => band.indexOf(needle);
    const order = [
      at("closing-band__heading"),
      at("closing-band__sub"),
      at("closing-band__body"),
      at("closing-band__actions"),
      at("closing-band__disclosure"),
    ];

    expect(order.every((i) => i > -1), `missing part in: ${order.join(",")}`).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(ruleBody(".closing-band__inner")).toMatch(/flex-direction:\s*column/);
    // The row rule the disclosures cannot live under. Its media query is unwrapped by ruleBody,
    // so a reinstated `flex-direction: row` on this selector shows up here.
    expect(ruleBody(".closing-band__inner")).not.toMatch(/flex-direction:\s*row/);
  });

  it("binds body and disclosure text to the specced tokens and measures", () => {
    // site-prelaunch.md §2: body = typography.body / text.secondary / 60ch;
    // disclosures = typography.caption / text.muted / 70ch.
    const body = ruleBody(".closing-band__body");
    const disclosure = ruleBody(".closing-band__disclosure");

    expect(body).toMatch(/color:\s*var\(--color-text-secondary\)/);
    expect(body).toMatch(/max-width:\s*60ch/);
    expect(disclosure).toMatch(/color:\s*var\(--color-text-muted\)/);
    expect(disclosure).toMatch(/max-width:\s*70ch/);
    expect(astro).toMatch(/class="closing-band__body type-body"/);
    expect(astro).toMatch(/class="closing-band__disclosure type-caption"/);
  });

  it("no longer colours the band's last paragraph by position", () => {
    // `.closing-band__inner p:last-child` used to be how the sub got its secondary ink. With
    // the disclosures appended it would retarget the LAST disclosure line instead — a silent
    // mis-paint that no copy or ordering assertion above would catch.
    expect(css).not.toMatch(/\.closing-band__inner\s+p:last-child/);
    expect(ruleBody(".closing-band__sub")).toMatch(/color:\s*var\(--color-text-secondary\)/);
  });
});
