// #4605 (FC4, PM portfolio-view.md): a rule applies only to the positions of its instrument, so the
// live site never says every position, or all of them, is checked. Pinned against the page sources.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const index = readFileSync(join(root, "index.astro"), "utf8");
const portfolio = readFileSync(join(root, "your-portfolio.astro"), "utf8");

const N284 = "Connecting adds Your Portfolio: your positions with their math, and your own rules on the positions they fit.";
const N291 = "Your Portfolio in full, the same as on every plan. Each option structure shows its net debit or credit, breakevens, max profit and max loss, and lists its paths with their math. A stock position shows its shares, average cost and market value. Your own rules are checked on current prices on the positions they fit. Free also includes 10 analyses a month.";
const N141 = "Your book, with your own rules checked on the positions they fit.";
const N171 = "Paths for each options structure you hold: up to four choices, each with its math.";

describe("coverage wording on the homepage and Your Portfolio (#4605)", () => {
  it("says the homepage FAQ's rules are checked on the positions they fit", () => {
    expect.soft(index).toContain("Your Portfolio shows the positions you hold with their math, and checks your own rules on current prices on the positions they fit.");
    expect.soft(index).not.toContain("shows every position you hold");
  });

  it("heads Your Portfolio with the positions its rules fit", () => {
    expect.soft(portfolio).toContain('<h1 class="type-display">Your positions at your broker, with their math and your own rules on the positions they fit.</h1>');
    expect.soft(portfolio).not.toContain("Every position at your broker");
  });

  it("describes Your Portfolio without claiming every position, within the 160-character field", () => {
    const description = portfolio.match(/description="([^"]+)"/)[1];
    expect.soft(description).toBe("See your positions, with breakevens, max profit and max loss on each option position it fits, and your rules checked on the positions they fit. On every plan.");
    expect.soft(description.length).toBeLessThanOrEqual(160);
  });

  it("keeps the PM's accuracy rulings on the homepage rows (#4605)", () => {
    expect.soft(index).toContain(N284);
    expect.soft(index).toContain(N291);
    expect.soft(index).toContain(N141);
    expect.soft(index).toContain(N171);
    expect.soft(index).not.toContain("Every position shows its structure");
    expect.soft(index).not.toContain("lists its scenarios and paths");
  });

  it("keeps the PM's accuracy rulings on the Your Portfolio rows (#4605)", () => {
    expect.soft(portfolio).toContain("Open an option structure for its breakevens and paths.");
    expect.soft(portfolio).toContain("See your own positions, with your rules checked on the ones they fit.");
    expect.soft(portfolio).not.toContain("Open any position for");
  });

  it("leaves the read-only answer as it was: seeing positions is access, not rule coverage", () => {
    expect.soft(index).toContain("TwiceOver can see your positions but cannot place, change or cancel an order");
  });
});
