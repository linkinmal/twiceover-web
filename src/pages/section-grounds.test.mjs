/**
 * The section-ground alternation rule (`site.css`: "Every top-level section declares a ground, and
 * no two adjacent sections share one"), as a check rather than a sentence.
 *
 * It was prose only until #3008 — a pure section reorder — moved `BeforeAfterRead` from 5th to 3rd
 * and broke the rule at TWO junctions, one of which was not the one the reorder's own issue named:
 * removing a section from a sequence changes the pairing it was separating as well as the pairing it
 * joins. A rule that only a reader enforces is a rule a reorder cannot fail against.
 *
 * Source-level, the convention this repo already uses (`faq-structure.test.mjs`). It resolves each
 * top-level section's ground the way the cascade does — the section's own `background`, or the
 * `--ground-fill` its `section-ground*` classes set — and follows component roots rather than taking
 * the page's literal `<section>`s only, since three of the twelve are rendered by components.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const css = read("src/styles/site.css");

/** Every style rule as {selector, body}, at-rules unwrapped and comments dropped. */
function rules(text) {
  const out = [];
  const stack = [];
  let buf = "";
  for (const ch of text.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      const sel = stack.pop();
      if (sel !== undefined && !sel.startsWith("@")) out.push({ selector: sel, body: buf });
      buf = "";
    } else buf += ch;
  }
  return out;
}
const styleRules = rules(css);

/**
 * The page's top-level sections, in order. A literal `<section class="…">` contributes its own
 * classes; a `<Component />` contributes its component's root `<section>`.
 */
function pageSections() {
  const page = read("src/pages/index.astro");
  // The page's markup starts after the frontmatter fence and is wrapped in <Base>, not <main>.
  const body = page.slice(page.indexOf("\n---", 3) + 4);
  const out = [];
  for (const [, cls, component] of body.matchAll(
    /^ {2}<section[^>]*\sclass="([^"]+)"|^ {2}<([A-Z]\w+)\s*\/>/gm,
  )) {
    if (cls !== undefined) {
      out.push({ name: cls.split(/\s+/)[0], classes: cls.split(/\s+/) });
      continue;
    }
    const src = read(`src/components/${component}.astro`);
    const rootClass = src.match(/<section[^>]*\sclass="([^"]+)"/);
    expect(rootClass, `${component}.astro has no root <section class>`).not.toBeNull();
    out.push({ name: component, classes: rootClass[1].split(/\s+/) });
  }
  // The dark trust plate opts out of the ground system entirely; it carries data-theme.
  return out;
}

/**
 * The fill a section actually paints, resolved the way the cascade resolves it: later rules win, a
 * `--ground-fill` custom property is followed through `.section-ground`'s own `background`, and a
 * section with its own `background` declaration uses that. Returns the token name, not a colour —
 * two tokens with equal values would still be a ground clash to a reader.
 */
function groundOf(section) {
  let fill = null;
  for (const { selector, body } of styleRules) {
    const target = selector.replace(/^\s+/, "");
    if (!section.classes.some((c) => target === `.${c}`)) continue;
    const custom = body.match(/--ground-fill:\s*var\((--[\w-]+)\)/);
    if (custom) fill = custom[1];
    const bg = body.match(/(?:^|\s|;)background:\s*var\((--[\w-]+)\)/);
    if (bg && bg[1] !== "--ground-fill") fill = bg[1];
  }
  return fill;
}

describe("section grounds alternate (site-prelaunch.md §2 'Section grounds')", () => {
  const sections = pageSections();

  it("finds every top-level section, components included", () => {
    // A resolver that silently sees fewer sections than the page has would pass vacuously — the
    // adjacency it checks would not be the page's adjacency.
    expect(sections.length).toBeGreaterThanOrEqual(12);
    expect(sections.map((s) => s.name)).toContain("AnalysisBand");
    expect(sections.map((s) => s.name)).toContain("BeforeAfterRead");
    expect(sections.map((s) => s.name)).toContain("MobileShowcase");
  });

  it("gives every section a ground", () => {
    // The rule's first half. A section with no resolvable fill inherits whatever is behind it, which
    // makes the adjacency check below unable to see it at all.
    const ungrounded = sections.filter((s) => !s.classes.includes("trust-plate") && !groundOf(s));
    expect(ungrounded.map((s) => s.name)).toEqual([]);
  });

  it("puts no two adjacent sections on the same ground", () => {
    const resolved = sections.map((s) => ({ name: s.name, fill: groundOf(s) }));
    const clashes = [];
    for (let i = 1; i < resolved.length; i++) {
      if (resolved[i].fill && resolved[i].fill === resolved[i - 1].fill) {
        clashes.push(`${resolved[i - 1].name} → ${resolved[i].name} (both ${resolved[i].fill})`);
      }
    }
    expect(clashes, `order: ${resolved.map((r) => `${r.name}:${r.fill}`).join(" | ")}`).toEqual([]);
  });
});
