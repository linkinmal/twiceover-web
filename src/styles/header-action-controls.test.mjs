/**
 * "Header action controls never wrap" (site-prelaunch.md §1 Global chrome → Header, v2.41,
 * stock-analyst-platform#3551 — founder-approved in chat 2026-09-04; build #3553), as a check
 * rather than a sentence.
 *
 * The invariant is a SHAPE, not one declaration, and each half fails differently:
 *   - `white-space: nowrap` alone, measured at a true 320px viewport, puts the button's right
 *     edge at 335.2px in a 320px window — border clipped, page gains a horizontal scroll.
 *   - the below-md padding/gap step alone leaves "Sign / up" stacked, so the button renders 74px
 *     tall inside the 64px `space.800` band and its outline crosses the header's bottom hairline.
 * So both are asserted, and the md restoration with them: ≥640px must render identically to what
 * shipped before the ruling, which is a property no narrow-viewport check can see.
 *
 * Source-level, the convention this repo already uses for a CSS rule that only a reader would
 * otherwise enforce (`section-grounds.test.mjs`, `faq-structure.test.mjs`). Unlike those, this one
 * needs the at-rule context — "the base value steps down AND the 640px rule restores it" is a
 * statement about which media block a declaration sits in — so the parser below keeps it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const css = readFileSync(join(root, "src/styles/site.css"), "utf8");

/**
 * Every style rule as {selector, body, media}, where `media` is the enclosing at-rule prelude
 * ("" at the top level). Comments are dropped first so a commented-out declaration never counts.
 */
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
      if (sel !== undefined && !sel.startsWith("@")) {
        out.push({ selector: sel, body: buf, media: stack.filter((s) => s.startsWith("@")).join(" ") });
      }
      buf = "";
    } else buf += ch;
  }
  return out;
}
const styleRules = rules(css);

/** The declarations that apply to `selector` in media context `media`, as a {prop: value} map. */
function declarations(selector, media = "") {
  const decls = {};
  for (const rule of styleRules) {
    if (rule.media !== media) continue;
    if (!rule.selector.split(",").some((s) => s.trim() === selector)) continue;
    for (const d of rule.body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return decls;
}

const MD = "@media (min-width: 640px)";

describe("header action controls", () => {
  it("declares white-space: nowrap on both halves of the logged-out pair", () => {
    // Not "the masthead button" — `.btn-quiet` is the site's one button class, so putting it on
    // the class is what makes the invariant hold wherever a header action control is built from it,
    // instead of drifting into a header-scoped override with its own second phone padding.
    expect(declarations(".site-header__signin")["white-space"]).toBe("nowrap");
    expect(declarations(".btn-quiet")["white-space"]).toBe("nowrap");
  });

  it("steps the button padding and actions gap down below md and restores both at md", () => {
    expect(declarations(".btn-quiet").padding).toBe("var(--space-150) var(--space-200)");
    expect(declarations(".btn-quiet", MD).padding).toBe("var(--space-150) var(--space-300)");
    expect(declarations(".site-header__actions").gap).toBe("var(--space-100)");
    expect(declarations(".site-header__actions", MD).gap).toBe("var(--space-200)");
  });

  it("keeps every .btn-quiet at the 44px tap target at every width", () => {
    // The padding step reduces the box; `min-height` is what holds the floor once it does.
    expect(declarations(".btn-quiet")["min-height"]).toBe("44px");
    expect(declarations(".btn-quiet", MD)["min-height"]).toBeUndefined();
  });
});
