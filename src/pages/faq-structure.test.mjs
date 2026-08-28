// Source-level regression coverage for the FAQ section (#2534 grouping, #2532
// chevron) — no DOM parser dependency in this repo's tooling, so this asserts
// against the .astro/.css source text directly, the same style ci/check-a11y-decor.mjs
// uses against built HTML. Scenario-grain: one Given/When per test, every
// promised facet soft-asserted together (conventions.md §Testing, ADR 0062).

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
let astro;
let css;
let faqList;

beforeAll(() => {
  astro = readFileSync(join(root, "index.astro"), "utf8");
  css = readFileSync(join(root, "..", "styles", "site.css"), "utf8");
  const start = astro.indexOf('<div class="faq__list">');
  const end = astro.indexOf("</section>", start);
  if (start === -1 || end === -1) throw new Error("faq__list block not found in index.astro");
  faqList = astro.slice(start, end);
});

const BEFORE_SIGNUP_GROUP = [
  "What is TwiceOver, exactly?",
  "Can TwiceOver trade on my behalf?",
  "Where does the data come from?",
  "Do I need to connect my brokerage to use it?",
  "Do I need a card to connect my brokerage?",
  "What does a connected free account actually see?",
  "Do I need to create an account to use it?",
  "Is my account data shared with anyone?",
];

const NEW_FIVE = [
  "What happens when the 14-day trial ends?",
  "How do I cancel?",
  "What if connecting my brokerage fails?",
  "What if some of the data isn't available?",
  "How do I get support?",
];

describe("FAQ grouping (#2534)", () => {
  it("splits the thirteen items into two labeled groups in spec order, unreordered within each", () => {
    const beforeIdx = faqList.indexOf(">Before you sign up<");
    const onceIdx = faqList.indexOf(">Once you're in<");
    expect(beforeIdx, '"Before you sign up" heading present').toBeGreaterThan(-1);
    expect(onceIdx, "\"Once you're in\" heading present").toBeGreaterThan(-1);
    expect(beforeIdx, "groups appear in spec order").toBeLessThan(onceIdx);

    // Both are real <h3> landmarks, not styled <p>/<div> text.
    expect(faqList, "Before-you-sign-up label is an <h3>").toMatch(
      /<h3[^>]*>Before you sign up<\/h3>/
    );
    expect(faqList, "Once-you're-in label is an <h3>").toMatch(/<h3[^>]*>Once you're in<\/h3>/);

    // Every question lands on the correct side of the group boundary, unreordered.
    let cursor = beforeIdx;
    for (const q of BEFORE_SIGNUP_GROUP) {
      const idx = faqList.indexOf(q, cursor);
      expect(idx, `"${q}" present after the group-1 heading`).toBeGreaterThan(-1);
      expect(idx, `"${q}" appears before group 2 starts`).toBeLessThan(onceIdx);
      cursor = idx + q.length;
    }
    cursor = onceIdx;
    for (const q of NEW_FIVE) {
      const idx = faqList.indexOf(q, cursor);
      expect(idx, `"${q}" present after the group-2 heading`).toBeGreaterThan(-1);
      cursor = idx + q.length;
    }
  });

  it("keeps accordion mechanics unchanged — exactly one open item, borders on every entry", () => {
    const detailsCount = (faqList.match(/<details/g) || []).length;
    const openCount = (faqList.match(/<details open/g) || []).length;
    expect(detailsCount, "thirteen total items").toBe(13);
    expect(openCount, "only one item starts open").toBe(1);
    // The one open item is the very first item of the whole list, not per-group.
    const firstDetailsIdx = faqList.indexOf("<details");
    expect(faqList.slice(firstDetailsIdx, firstDetailsIdx + 20)).toMatch(/^<details open/);

    expect(css, "top+bottom border.strong rule on every item").toMatch(
      /\.faq__list details\s*{\s*border-top:\s*1px solid var\(--color-border-strong\)/
    );
    expect(css, "last item still gets a closing border (last-of-type, not last-child)").toMatch(
      /\.faq__list details:last-of-type\s*{\s*border-bottom:\s*1px solid var\(--color-border-strong\)/
    );
  });

  it("styles group labels with the section's existing kicker recipe — no new token", () => {
    expect(faqList, "group labels carry the type-caption utility, same as .faq__kicker").toMatch(
      /<h3 class="type-caption faq__group-label">Before you sign up<\/h3>/
    );
    expect(faqList).toMatch(/<h3 class="type-caption faq__group-label">Once you're in<\/h3>/);

    const rule = css.match(/\.faq__group-label\s*{([^}]*)}/);
    expect(rule, ".faq__group-label rule exists").not.toBeNull();
    expect(rule[1], "reuses --color-text-muted, the exact .faq__kicker color token").toMatch(
      /var\(--color-text-muted\)/
    );
    // No brand-new custom property minted for this — every var() referenced by
    // the new rules must already be USED elsewhere in the stylesheet (the tokens
    // themselves are declared in a gitignored generated tokens.css, never here —
    // conventions.md, ADR 0004/consultation 0005 — so "already exists" means
    // "already referenced by an existing rule", not "declared in this file").
    const groupLabelBlock = css.match(/\.faq__group-label[^{]*{[^}]*}/g).join("\n");
    const restOfFile = css.replace(/\.faq__group-label[^{]*{[^}]*}/g, "");
    const newVars = [...groupLabelBlock.matchAll(/var\((--[\w-]+)\)/g)].map((v) => v[1]);
    for (const v of newVars) {
      expect(restOfFile.includes(`var(${v})`), `${v} is already used elsewhere, not newly minted here`).toBe(true);
    }
  });
});

describe("FAQ chevron (#2532)", () => {
  it("gives every item a chevron affordance that rotates open, cross-browser", () => {
    const chevronCount = (faqList.match(/faq__chevron/g) || []).length;
    // One SVG per summary (13 markup occurrences) — CSS selectors add more hits below.
    expect(chevronCount, "a chevron element in every one of the thirteen summaries").toBeGreaterThanOrEqual(13);
    expect(faqList, "chevron is an aria-hidden decorative SVG, matching the trust-card icon convention").toMatch(
      /<svg class="faq__chevron"[^>]*viewBox="0 0 24 24"[^>]*aria-hidden="true"/
    );

    expect(css, "rotation is keyed to the native [open] state, no JS").toMatch(
      /\.faq__list details\[open\]\s*>\s*summary \.faq__chevron\s*{[^}]*transform:\s*rotate\(180deg\)/
    );
    expect(css, "reduced-motion users don't get the transition").toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{\s*\.faq__chevron\s*{\s*transition:\s*none/
    );

    // Cross-browser marker suppression: the legacy WebKit rule stays, plus the
    // standards-track list-style fallback Firefox needs (::-webkit-details-marker
    // is WebKit-only and does nothing in Firefox).
    expect(css).toMatch(/\.faq__list summary::-webkit-details-marker\s*{\s*display:\s*none/);
    expect(css, "list-style: none suppresses Firefox's native marker too").toMatch(
      /\.faq__list summary\s*{[^}]*list-style:\s*none/
    );
  });
});
