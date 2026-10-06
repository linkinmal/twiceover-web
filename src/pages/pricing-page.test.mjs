/**
 * /pricing with three plans (stock-analyst-platform#3829; ADR 0912 Amendment 1, build reference
 * ai-team/design/assets/pricing-page-c4-three-plans-2026-09-24.html, #3962; Premium's copy and
 * trial disclosure filled by Growth on #3693).
 *
 * Source-level against the .astro/.css text, the convention this repo uses (there is no DOM parser
 * in the build pipeline). Scenario-grain: one Given/When per test, every promised facet
 * soft-asserted together (conventions.md §Testing, ADR 0062). The strip-to-card quotations (caps,
 * plan lines) live in pricing-strip-and-closing-band.test.mjs; the section list and its groups in
 * src/data/sections.test.mjs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GO_DESTINATIONS } from "../../worker/index.js";
import { SECTIONS } from "../data/sections.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(root, "pricing.astro"), "utf8");
const css = readFileSync(join(root, "..", "styles", "site.css"), "utf8");
const frontmatter = source.match(/^---([\s\S]*?)---/)[1];
/** The template alone, its JSX comments gone — what the page renders. */
const template = source.slice(source.indexOf("---", 3) + 3).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const clean = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Text of every element carrying `cls`, in document order. */
function textsOf(src, cls) {
  const re = new RegExp(`<([a-z0-9]+)[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, "g");
  return [...src.matchAll(re)].map(([, , inner]) => clean(inner));
}

/** Each plan card, keyed by its eyebrow. */
const cards = Object.fromEntries(
  template
    .split('<li class="tier">')
    .slice(1)
    .map((card) => [textsOf(card, "tier__eyebrow")[0], card]),
);

const ctaOf = (card) => {
  const [, href, label] = card.match(/<a class="btn-quiet tier__cta" href="([^"]+)">([^<]+)<\/a>/) ?? [];
  return { href, label };
};

describe("the three plan cards", () => {
  it("shows Free, Core and Premium with their price and allowance, and no ruled feature list", () => {
    expect.soft(Object.keys(cards)).toEqual(["Free", "Core", "Premium"]);
    expect.soft(textsOf(template, "tier__price")).toEqual(["$0", "$49/mo", "$99/mo"]);
    // Ruling 1: one plan line per card; the section table below is where the plans differ.
    expect.soft(template).not.toMatch(/tier__rows/);
    for (const [plan, card] of Object.entries(cards)) {
      expect.soft(textsOf(card, "tier__line"), `${plan} has one plan line`).toHaveLength(1);
    }
  });

  it("sends each button to the app with its own plan's intent", () => {
    // `?tier=` on /go/plan would be dropped by the forwarder and land on Core's intent, so each
    // paid card needs its own /go/* route whose hardcoded destination names that plan.
    const expected = {
      Free: { href: "/go/try", label: "Run a free analysis" },
      Core: { href: "/go/plan", label: "Start 14-day trial" },
      Premium: { href: "/go/plan-premium", label: "Start 14-day trial" },
    };
    for (const [plan, card] of Object.entries(cards)) {
      const cta = ctaOf(card);
      expect.soft(cta, plan).toEqual(expected[plan]);
      expect.soft(Object.keys(GO_DESTINATIONS), `${plan}'s route exists`).toContain(cta.href);
    }
    expect.soft(GO_DESTINATIONS["/go/plan"]).toMatch(/#signin\?intent=core$/);
    expect.soft(GO_DESTINATIONS["/go/plan-premium"]).toMatch(/#signin\?intent=premium$/);
  });

  it("carries the trial disclosure beside both trial buttons, identical but for the price", () => {
    // ADR 0145 (Amendment 9 for Premium): the negative-option disclosure travels with the CTA it
    // qualifies. Free charges nothing, so it owes none.
    const disclosure = (plan) => textsOf(cards[plan], "tier__disclosure");
    const afterCta = (plan) => {
      const card = cards[plan];
      return card.indexOf("tier__disclosure") > card.indexOf("tier__cta");
    };

    expect.soft(disclosure("Free")).toEqual([]);
    expect.soft(disclosure("Core")).toEqual([
      "Free for 14 days. Then $49/month, charged automatically to the card you save at checkout.",
      "Cancel any time before the trial ends — one click in Settings, no charge. We email you three days before.",
    ]);
    expect.soft(disclosure("Premium")).toEqual(disclosure("Core").map((l) => l.replace("$49", "$99")));
    expect.soft(afterCta("Core"), "Core's disclosure follows its button").toBe(true);
    expect.soft(afterCta("Premium"), "Premium's disclosure follows its button").toBe(true);
  });

  it("advertises in structured data exactly the offers the cards redeem", () => {
    // Each Offer's url is the live CTA it is redeemed through, so it must be that card's own.
    // Guarded: with no cards found, the loop below would assert nothing and pass.
    expect.soft(Object.keys(cards)).toHaveLength(3);
    for (const [plan, card] of Object.entries(cards)) {
      const offer = frontmatter.match(new RegExp(`\\{[^}]*name:\\s*"${plan}"[^}]*\\}`))?.[0] ?? "";
      expect.soft(offer, `${plan} offer`).toContain(`url: "https://twiceover.io${ctaOf(card).href}"`);
    }
  });

  it("holds all three buttons on one row from 860px, and stacks the cards below it", () => {
    // Ruling 3: a subgrid keeps the CTAs level whatever each card's copy length. There is no
    // two-up state; three plans go from one column straight to three.
    const gridAt860 = css.search(/@media \(min-width: 860px\) \{\s*\.tier-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    const subgridAt860 = css.search(/@media \(min-width: 860px\) \{\s*\.tier\s*\{[^}]*grid-row:\s*span 3;[^}]*grid-template-rows:\s*subgrid/);
    const baseTier = css.search(/\n\.tier \{[^}]*display:\s*flex/);
    expect.soft(gridAt860, "three columns from 860px").toBeGreaterThan(-1);
    expect.soft(subgridAt860, "each card spans a three-row subgrid from 860px").toBeGreaterThan(-1);
    // Cascade order is the guarantee: the base rule's `display: flex` has equal specificity, so
    // a subgrid declared before it never forms (measured: Premium's CTA sat 24px low).
    expect.soft(subgridAt860, "subgrid rule comes after the base .tier rule").toBeGreaterThan(baseTier);
    expect.soft(css).not.toMatch(/\.tier-grid\s*\{\s*grid-template-columns:\s*repeat\(2/);
  });
});

describe("the section-by-plan table", () => {
  it("renders from the site's one section list, typing no section of its own", () => {
    // ADR 0990: /pricing must never disagree with the homepage band. The rows, their captions
    // and the 6 / 10 / 13 totals all come from src/data/sections.mjs.
    expect.soft(frontmatter).toMatch(/import \{[^}]*sectionGroups[^}]*\} from "\.\.\/data\/sections\.mjs"/);
    expect.soft(frontmatter).toMatch(/import \{[^}]*sectionsOn[^}]*\} from "\.\.\/data\/sections\.mjs"/);
    // Scoped to the table: the plan lines and footnote name "the Outlook" in running prose.
    const table = clean(template.slice(template.indexOf("<table"), template.indexOf("</table>")));
    expect.soft(table, "table markup found").not.toBe("");
    for (const s of SECTIONS) {
      expect.soft(table, `"${s.name}" typed into the table`).not.toContain(s.name);
      expect.soft(table, `${s.name}'s caption typed into the table`).not.toContain(s.tagline);
    }
    expect.soft(table, "a total typed into the table").not.toMatch(/\b(6|10|13)\b/);
  });

  it("carries the heading, lead and both footnotes as signed off", () => {
    expect.soft(textsOf(template, "plans__title")).toEqual(["What each plan includes"]);
    expect.soft(textsOf(template, "plans__lead")).toEqual([
      "Your Portfolio comes with every plan. The plans differ in which sections of the analysis they include.",
    ]);
    expect.soft(textsOf(template, "plans__foot")).toEqual([
      "Each plan's Outlook weighs only the sections that plan shows.",
      "Every figure in a section carries its source and the exact time it was fetched.",
    ]);
  });

  it("marks each cell for a screen reader, not only with the ink dot", () => {
    // The dot and the dash are decoration; the words are what a screen reader hears.
    expect.soft(template).toMatch(/<span class="dot" aria-hidden="true"><\/span><span class="visually-hidden">Included<\/span>/);
    expect.soft(template).toMatch(/<span class="none" aria-hidden="true"><\/span><span class="visually-hidden">Not included<\/span>/);
    expect.soft(template).toMatch(/<caption class="visually-hidden">Sections of the analysis included on each plan<\/caption>/);
    expect.soft(template).toMatch(/scope="rowgroup"/);
    expect.soft(template).toMatch(/scope="row"/);
  });
});
