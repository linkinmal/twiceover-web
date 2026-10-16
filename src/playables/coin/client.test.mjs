// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { init } from "./client.mjs";
import { barsAll, formatMoney } from "./coin-game.mjs";

// The served markup the page carries, reduced to what the script touches.
function served() {
  const bars = barsAll();
  document.body.innerHTML = `<div data-coin>
    <p data-nojs>needs script</p>
    <div data-controls hidden>
      <div class="chips">${[0.05, 0.1, 0.2, 0.4, 0.6, 1].map((x) => `<button type="button" class="chip" data-f="${x}" aria-pressed="false">${Math.round(x * 100)}%</button>`).join("")}</div>
      <b data-w></b><span data-n></span><svg data-run></svg>
      <button data-one>one</button><button data-end>end</button><button data-again hidden>again</button><p data-cap></p>
      <p data-wait>wait</p>
    </div>
    <div data-all><p data-line></p><div data-bars><div class="sb hd"><span>Bet</span></div>
      ${bars.map((b) => `<div class="sb" data-f="${b.fraction}" data-cap-pct="${b.cap}" data-bust-pct="${b.bust}" data-median="${formatMoney(b.median)}"><span>${Math.round(b.fraction * 100)}%</span></div>`).join("")}
    </div></div></div>`;
  return document.querySelector("[data-coin]");
}
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

describe("the coin block script", () => {
  let root;
  let api;
  beforeEach(() => {
    root = served();
    api = init(root, { seed: 1987, reduceMotion: true });
  });

  it("shows the controls, hides the bars until a game ends and the no-script line for good", () => {
    expect(root.querySelector("[data-controls]").hidden).toBe(false);
    expect(root.querySelector("[data-nojs]").hidden).toBe(true);
    expect(root.querySelector("[data-all]").hidden).toBe(true);
    expect(root.querySelector("[data-wait]").hidden).toBe(false);
    expect(root.querySelector("[data-w]").textContent).toBe("$25.00");
  });

  it("turns the served bar rows into buttons that pick that bet, and the chips agree", () => {
    const rows = root.querySelectorAll("button.sb[data-f]");
    expect(rows).toHaveLength(6);
    click(root.querySelector('button.sb[data-f="0.4"]'));
    expect(api.state().f).toBe(0.4);
    expect(root.querySelector('.chip[data-f="0.4"]').getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector('.chip[data-f="0.2"]').getAttribute("aria-pressed")).toBe("false");
    expect(root.querySelector("[data-line]").innerHTML).toContain("Betting <b>40%</b>");
  });

  it("flips once at the chosen share and takes the next bet from the new stack", () => {
    click(root.querySelector("[data-one]"));
    const s = api.state();
    expect(s.run).toHaveLength(2);
    expect([30, 20]).toContain(s.run[1]);
    expect(root.querySelector("[data-cap]").textContent).toMatch(/^(Heads|Tails)\. You bet \$5\.00 and (won|lost) it\. Next bet at 20%: \$/);
  });

  it("plays to the end, reveals the bars and counts the game; New game starts again at $25 and keeps the tally", () => {
    click(root.querySelector("[data-end]"));
    let s = api.state();
    expect(s.over).toBe(true);
    expect(s.tally.reduce((a, b) => a + b, 0)).toBe(1);
    expect(root.querySelector("[data-all]").hidden).toBe(false);
    expect(root.querySelector("[data-wait]").hidden).toBe(true);
    expect(root.querySelector("[data-again]").hidden).toBe(false);
    expect(root.querySelector("[data-one]").hidden).toBe(true);
    click(root.querySelector("[data-again]"));
    expect(api.state().run).toEqual([25]);
    click(root.querySelector("[data-end]"));
    s = api.state();
    expect(s.tally.reduce((a, b) => a + b, 0)).toBe(2);
    expect(root.querySelector("[data-cap]").textContent).toMatch(/Your 2 games: \d+ cap, \d+ bust, \d+ neither\./);
  });

  it("takes every figure it prints from the served page, so the page and the script cannot disagree", () => {
    click(root.querySelector('button.sb[data-f="1"]'));
    const row = root.querySelector('button.sb[data-f="1"]');
    const line = root.querySelector("[data-line]").textContent;
    expect(line).toContain(`cap in ${row.dataset.capPct}% of games`);
    expect(line).toContain(`bust in ${row.dataset.bustPct}%`);
    expect(line).toContain(`ended at ${row.dataset.median}.`);
  });

  it("never fails to start on a page without the block, and a game at 100% ends in a bust or the cap", () => {
    expect(init(document.createElement("div"))).toBeNull();
    click(root.querySelector('.chip[data-f="1"]'));
    click(root.querySelector("[data-end]"));
    const last = api.state().run.at(-1);
    expect(last >= 250 || last < 2).toBe(true);
  });
});
