/**
 * The Pricing strip and the Closing band's trial-disclosure copy (stock-analyst-platform#3030,
 * realizing #2812 bullets 2/3; site-prelaunch.md §2 "Pricing strip" and "Closing band gains
 * trial-disclosure copy", build reference ai-team/design/assets/pricing-strip-and-closing-band-
 * trial-2026-08-28.html; divider and link geometry superseded by v2.39, build reference
 * ai-team/design/assets/pricing-strip-divider-and-link-2026-09-02.html, #3139).
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

/** Every style rule as {selector, body, at} — `at` is the enclosing at-rule prelude, "" at top level. */
function styleRules() {
  const rules = [];
  const stack = [];
  let buf = "";
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      const sel = stack.pop();
      if (sel !== undefined && !sel.startsWith("@")) {
        rules.push({ selector: sel, body: buf, at: stack.filter((s) => s.startsWith("@")).join(" ") });
      }
      buf = "";
    } else buf += ch;
  }
  return rules;
}

const bodiesOf = (pred) => styleRules().filter(pred).map((r) => r.body).join("\n");

/** The body of every CSS rule whose selector is exactly `selector`, at-rules unwrapped. */
const ruleBody = (selector) => bodiesOf((r) => r.selector === selector);

/** Same, rules outside every at-rule — the top-level half of what a viewport under 640px resolves. */
const baseRuleBody = (selector) => bodiesOf((r) => r.selector === selector && r.at === "");

/** Same, inside the >=640px block only — the two-column state the v2.39 ruling is about. */
const wideRuleBody = (selector) =>
  bodiesOf((r) => r.selector === selector && /min-width:\s*640px/.test(r.at));

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
    //
    // The cap line moved OUT of the feature list and into the card's figure block with the C4
    // "Paper board" redesign (ADR 0912, #3549): it is now a split figure/word pair, not an `<li>`.
    // The extractor follows it there rather than pinning the new strings — a `<li>`-shaped one
    // matched nothing after the redesign, which reads as "no cap bullets" rather than as drift.
    //
    // It reads the cap's TEXT (tags stripped, whitespace collapsed) rather than joining the two
    // spans with a space of its own. The 10px between them is flex `gap`, so a join here would
    // manufacture a separator the markup need not have — and the markup without one copies and
    // reads out as "10reads a month" while looking perfectly correct on screen.
    const captions = textsOfClass(astro, "pricing-stat__caption");
    const pricingCaps = [...pricingAstro.matchAll(/<p class="tier__cap">([\s\S]*?)<\/p>/g)].map(
      ([, inner]) => inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    );

    expect(pricingCaps, "pricing.astro no longer has the two cap figures").toHaveLength(2);
    expect(captions).toEqual(pricingCaps);
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

  it("starts the interior divider at the strip's top rule, so it runs the band's full height", () => {
    // site-prelaunch.md §2 v2.39 (#3139), build reference assets/pricing-strip-divider-and-link-
    // 2026-09-02.html, `data-divider="band"`: the block padding moves off the ground and onto the
    // cells. Measured at 1280 before the change — the divider ran 103.2px of a 281.2px section,
    // 48px short at the top and 130px at the bottom; it now runs 199.2px flush to the top rule.
    // Geometry, not contrast: the same token reads at 1.11:1 on the Depth strip, whose cells
    // already carry their own padding, against 1.37:1 here.
    const strip = wideRuleBody(".pricing-strip.section-ground");
    const stat = wideRuleBody(".pricing-stat");

    // Compounded with .section-ground on purpose: at a plain (0,1,0) this would beat the shared
    // ground rule on source order alone, and revert silently if that rule ever gained a
    // media-query refinement below this block. The selector IS the guarantee, so it is asserted.
    expect(strip).toMatch(/padding-block-start:\s*0(?=\s*[;}])/);
    expect(stat).toMatch(/padding-block:\s*var\(--space-600\)\s*(?=[;}])/);
    expect(stat).toMatch(/border-right:\s*1px solid var\(--color-border-default\)/);
    // The stacked state zeroes `:first-child`'s top padding at (0,3,0), which outranks the
    // (0,1,0) rule above no matter that it is nested in a media query. Measured under that
    // mutation: the divider does NOT shorten — Core's cell is the taller, so it sets the row
    // height and grid stretch keeps the border running the band — but Free alone loses its 48px
    // and that column's contents sit 48px above Core's. Column misalignment, invisible to every
    // other assertion here.
    expect(wideRuleBody(".pricing-strip__grid .pricing-stat:first-child")).toMatch(
      /padding-block-start:\s*var\(--space-600\)(?=\s*[;}])/,
    );
    expect(baseRuleBody(".pricing-strip__grid .pricing-stat:first-child")).toMatch(
      /padding-block-start:\s*0(?=\s*[;}])/,
    );
    // Stacked, the divider is a bottom hairline between the cells and the ground still pays the
    // block padding — there is no full band for it to run.
    expect(baseRuleBody(".pricing-stat")).toMatch(/border-bottom:\s*1px solid var\(--color-border-default\)/);
  });

  it("keeps the band's closing padding on the ground, where it cannot collapse away", () => {
    // The one deviation from the approved artifact, which parks that 48px on a `.link-band`
    // wrapper this markup has no equivalent for. Measured under the artifact-literal variant
    // (`padding-block: 0` + `margin-block-end` on the link): `.pricing-strip` establishes no BFC
    // and carries no bottom border, so the link's bottom margin collapses straight out — the
    // raised ground ended flush with the link and the 48px below it painted canvas.
    // Both routes back to that state are guarded: zeroing the ground's closing padding, and
    // moving the 48px onto the link in any at-rule.
    expect(wideRuleBody(".pricing-strip.section-ground")).not.toMatch(/padding-block(-end)?:/);
    expect(ruleBody(".pricing-strip__link")).not.toMatch(/margin-block-end/);
    expect(ruleBody(".pricing-strip__link.btn-quiet")).not.toMatch(/margin-block-end/);
  });

  it("centres the shared link on the divider axis at two columns", () => {
    // site-prelaunch.md §2 v2.39: built at left:88px inside a Free column spanning 88-640, the
    // page's one pricing link read as Free-scoped. Centring lands it on the seam, where it
    // belongs to neither column and therefore to both. `.btn-quiet` is inline-flex, so auto
    // inline margins do nothing until the box is block-level — the facet that would regress.
    // Compounded with .btn-quiet for the same source-order reason as the divider rule above.
    const link = wideRuleBody(".pricing-strip__link.btn-quiet");

    expect(link).toMatch(/display:\s*flex(?=\s*[;}])/);
    expect(link).toMatch(/width:\s*fit-content/);
    expect(link).toMatch(/margin-inline:\s*auto/);
    // `margin-inline: auto` centres on the CONTAINER; that is the divider axis only because the
    // two columns are equal with symmetric inline padding. Unequal columns would still satisfy
    // every assertion above while missing the seam.
    expect(wideRuleBody(".pricing-strip__grid")).toMatch(/grid-template-columns:\s*repeat\(2,\s*1fr\)/);
    // Stacked: no columns, so no seam. Rhythm as shipped, and no inline centring — this rule sits
    // AFTER the media block, so a margin-inline added here would win at >=640 too.
    expect(baseRuleBody(".pricing-strip__link")).toMatch(/margin-block-start:\s*var\(--space-400\)/);
    expect(baseRuleBody(".pricing-strip__link")).not.toMatch(/margin-inline/);
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
