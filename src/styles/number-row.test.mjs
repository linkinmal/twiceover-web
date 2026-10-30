// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The kit's typed number row: a mark after the number sits on the box's left padding; a $ in front is unchanged.
// The selector under test is read out of blog.css itself, then run on the two markup shapes the pages use.
const css = readFileSync(join(process.cwd(), "src/styles/blog.css"), "utf8");
const found = css.match(/^\s*(\.sd-field[^{}]*:first-child)\{padding-left:10px\}/m);
const SELECTOR = found?.[1];

describe("the typed number row", () => {
  it("has a rule that gives the number a 10px left padding, the same as the mark's", () => {
    expect(SELECTOR).toBeTruthy();
    expect.soft(css).toContain(".sd-field .in span{padding:0 10px;");
  });

  it("matches a box whose number comes first (the % page), and not one that opens with a $ (the straddle page)", () => {
    document.body.innerHTML = `
      <div class="sd-field"><div class="in"><input id="trail"><span>%</span></div></div>
      <div class="sd-field"><div class="in"><span>$</span><input id="lead"></div></div>`;
    const hit = [...document.querySelectorAll(SELECTOR)].map((e) => e.id);
    expect(hit).toEqual(["trail"]);
  });
});
