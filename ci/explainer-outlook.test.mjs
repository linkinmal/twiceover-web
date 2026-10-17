/**
 * The explainer's Outlook picture, built (stock-analyst-platform#4392, Designer ruling #4388, site-prelaunch.md v2.48).
 * The product rests every card folded, so the picture draws the same: no condition text on the page in any placement
 * (absent from the markup, not hidden by CSS), a static chevron on each healthy card, none on the dark far card.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { DEGRADED_FAR_LINE, EXMP_OUTLOOK } from "../src/charts/exmp-fixture.mjs";

const root = new URL("..", import.meta.url).pathname;
let html;
let doc;
beforeAll(() => {
  const out = mkdtempSync(join(tmpdir(), "explainer-outlook-"));
  const tokens = spawnSync(process.execPath, ["scripts/build-tokens.mjs"], { cwd: root, encoding: "utf8" });
  if (tokens.status !== 0) throw new Error(tokens.stderr);
  const scripts = spawnSync(process.execPath, ["scripts/build-blog-scripts.mjs"], { cwd: root, encoding: "utf8" });
  if (scripts.status !== 0) throw new Error(scripts.stderr);
  const r = spawnSync(process.execPath, [join(root, "node_modules/astro/astro.js"), "build", "--outDir", out], { cwd: root, encoding: "utf8", timeout: 120000 });
  if (r.status !== 0) throw new Error(`astro build failed:\n${r.stdout}\n${r.stderr}`);
  html = readFileSync(join(out, "how-our-analysis-works/index.html"), "utf8");
  doc = new JSDOM(html).window.document;
}, 150000);

describe("the Outlook picture on how-our-analysis-works", () => {
  it("carries no condition text in any of its three placements: no note element, none of the fixture's note strings", () => {
    expect.soft(doc.querySelectorAll(".xp-hz__n").length, "condition elements").toBe(0);
    for (const h of EXMP_OUTLOOK.horizons) {
      expect.soft(html.includes(h.note), `${h.key} note in the page`).toBe(false);
    }
  });

  it("draws a static aria-hidden chevron on each healthy card and none on the dark far card", () => {
    const rows = [...doc.querySelectorAll(".xp-hzrow")];
    expect.soft(rows.length, "placements").toBe(3);
    const healthy = rows.map((row) => row.querySelectorAll(".xp-hz:not(.xp-hz--dark)").length);
    const chevrons = rows.map((row) => row.querySelectorAll(".xp-hz:not(.xp-hz--dark) > .xp-hz__ch[aria-hidden='true']").length);
    expect.soft(healthy).toEqual([3, 3, 2]);
    expect.soft(chevrons).toEqual([3, 3, 2]);
    expect.soft(doc.querySelectorAll(".xp-hz__ch").length, "all chevrons").toBe(8);
    const dark = doc.querySelectorAll(".xp-hz--dark");
    expect.soft(dark.length, "dark cards").toBe(1);
    expect.soft(dark[0].querySelector(".xp-hz__ch"), "chevron on dark card").toBeNull();
    expect.soft(dark[0].querySelector(".xp-hz__deg")?.textContent?.trim()).toBe(DEGRADED_FAR_LINE);
    for (const c of doc.querySelectorAll(".xp-hz__ch")) {
      expect.soft(c.tagName, "static span").toBe("SPAN");
      expect.soft(c.hasAttribute("tabindex") || c.closest("a,button"), "no behaviour").toBeFalsy();
    }
  });
});
