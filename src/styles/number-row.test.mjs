// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The kit's typed number row: a mark after the number sits on the box's left padding; a $ in front is unchanged.
const css = readFileSync(join(process.cwd(), "src/styles/blog.css"), "utf8");
const RULE = ".sd-field .in>input:first-child";

describe("the typed number row", () => {
  it("gives a number with a trailing mark the box's left padding, and says how much", () => {
    expect.soft(css).toContain(`${RULE}{padding-left:10px}`);
    expect.soft(css).toContain(".sd-field .in span{padding:0 10px;");
  });

  it("matches only a box whose number comes first: the straddle page's leading $ is not touched", () => {
    document.body.innerHTML = `
      <div class="sd-field"><div class="in" id="trail"><input><span>%</span></div></div>
      <div class="sd-field"><div class="in" id="lead"><span>$</span><input></div></div>`;
    expect.soft(document.querySelector(`.sd-field #trail > input:first-child`)).not.toBeNull();
    expect.soft(document.querySelector(`.sd-field #lead > input:first-child`)).toBeNull();
  });
});
