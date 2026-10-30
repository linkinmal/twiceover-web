// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { init } from "./client.mjs";
import { EXAMPLES, PAYOFF_MESSAGE, WIN_MESSAGE, runOdds } from "./position-size.mjs";
import { answerHtml, barsHtml, chartParts, firstTradeText, payoffNote, sayText, tallyText, winNote } from "./position-size-view.mjs";

// The served markup the page carries, reduced to what the script touches: the opening example printed by the build.
function served() {
  const r = runOdds(EXAMPLES[0].win, EXAMPLES[0].payoff);
  const c = chartParts(r, 10);
  document.body.innerHTML = `<div data-ruin>
    <p data-nojs>The example</p>
    <p data-say>${sayText(r, 10)}</p>
    <div data-chart>
      <svg class="rc-wide" viewBox="0 0 752 300" data-view="wide" aria-label="${c.label}">${c.wide}</svg>
      <svg class="rc-narrow" viewBox="0 0 358 230" data-view="narrow" aria-label="${c.label}">${c.narrow}</svg>
    </div>
    <div data-js hidden>
      <input type="range" id="pr-size" min="1" max="60" step="1" value="10"><i data-tick hidden></i>
      <span data-read>10%</span><button type="button" data-replay>Replay</button><p data-tick-note></p>
    </div>
    <p data-tally>${c.tally}</p>
    <div data-ans>${answerHtml(r, 10)}</div>
    <div data-js hidden><button type="button" data-another>Try another example</button></div>
    <section data-js hidden>
      <div data-field="win"><input id="pr-win" value="60" aria-describedby="pr-win-n"><small id="pr-win-n">${winNote(r)}</small></div>
      <div data-field="payoff"><input id="pr-pay" value="100" aria-describedby="pr-pay-n"><small id="pr-pay-n">${payoffNote(r)}</small></div>
    </section>
    <div data-bars>${barsHtml(r, 10)}</div>
    <p data-first>${firstTradeText(r, 10)}</p>
  </div>`;
  return document.querySelector("[data-ruin]");
}
const type = (el, v) => {
  el.value = v;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

describe("the position size block script", () => {
  let root;
  let api;
  const q = (s) => root.querySelector(s);
  beforeEach(() => {
    root = served();
    api = init(root, { random: () => 0.5 });
  });

  it("shows the controls, hides the no-script line, and leaves the printed example as it was served", () => {
    const r = runOdds(60, 100);
    expect.soft([...root.querySelectorAll("[data-js]")].every((n) => n.hidden === false)).toBe(true);
    expect.soft(q("[data-nojs]").hidden).toBe(true);
    expect.soft(q("[data-say]").textContent).toBe(sayText(r, 10));
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(r, 10));
    expect.soft(q("[data-bars]").innerHTML).toBe(barsHtml(r, 10));
    expect.soft(q("#pr-size").getAttribute("aria-valuetext")).toBe("10% of the account on each trade");
    expect.soft(q("[data-chart] .rc-wide").innerHTML).toBe(chartParts(r, 10).wide);
    expect.soft(q("[data-tally]").textContent).toBe(chartParts(r, 10).tally);
  });

  it("moves the sentence, the tiles and the marked row with the slider", () => {
    const r = runOdds(60, 100);
    type(q("#pr-size"), "37");
    expect.soft(api.state().size).toBe(37);
    expect.soft(q("[data-say]").textContent).toBe(sayText(r, 37));
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(r, 37));
    expect.soft(q("[data-bars] .sb.on").textContent).toMatch(/^37%/);
    expect.soft(q("[data-first]").textContent).toBe(firstTradeText(r, 37));
    expect.soft(q("#pr-size").getAttribute("aria-valuetext")).toBe("37% of the account on each trade");
  });

  it("moves the chart, its tally and its text alternative with the same slider, over the same thirty flips", () => {
    const r = runOdds(60, 100);
    type(q("#pr-size"), "30");
    const c = chartParts(r, 30);
    expect.soft(q("[data-chart] .rc-wide").innerHTML).toBe(c.wide);
    expect.soft(q("[data-chart] .rc-narrow").innerHTML).toBe(c.narrow);
    expect.soft(q("[data-chart] .rc-wide").getAttribute("aria-label")).toBe(c.label);
    expect.soft(q("[data-tally]").textContent).toBe(tallyText({ ahead: 11, half: 18, neither: 1 }));
    expect.soft(q("[data-read]").textContent).toBe("30%");
    expect.soft(document.querySelectorAll("input[type=range]")).toHaveLength(1);
  });

  it("puts the ochre tick at the fastest-growing size, and takes it away when there is no positive edge", () => {
    expect.soft(q("[data-tick]").hidden).toBe(false);
    expect.soft(q("[data-tick]").style.left).toContain("0.322");
    expect.soft(q("[data-tick-note]").textContent).toBe("The tick marks 20%, the size that grows the account fastest.");
    type(q("#pr-win"), "50");
    expect.soft(q("[data-tick]").hidden).toBe(true);
    expect.soft(q("[data-tick-note]").textContent).toBe("");
  });

  it("redraws the same paths on Replay at rest when the reader asks for reduced motion", () => {
    window.matchMedia = () => ({ matches: true });
    const before = q("[data-chart] .rc-wide").innerHTML;
    click(q("[data-replay]"));
    expect.soft(q("[data-chart] .rc-wide").innerHTML).toBe(before);
    expect.soft(q("[data-chart] clipPath")).toBeNull();
    expect.soft(q("[data-tally]").textContent).toBe(chartParts(runOdds(60, 100), 10).tally);
    delete window.matchMedia;
  });

  it("draws the paths left to right on Replay: a clip opens over them, then goes", () => {
    const frames = [];
    const raf = (f) => frames.push(f);
    const old = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;
    click(q("[data-replay]"));
    const g = q("[data-chart] .rc-wide .rc-runs");
    expect.soft(g.getAttribute("clip-path")).toBe("url(#rc-clip-wide)");
    expect.soft(q("#rc-clip-wide rect").getAttribute("width")).toBe("0");
    // A frame stamped before the click (as a browser's can be) must not break the clock: the first frame is time zero.
    frames.splice(0).forEach((f) => f(1000));
    frames.splice(0).forEach((f) => f(1800));
    expect.soft(Number(q("#rc-clip-wide rect").getAttribute("width"))).toBeGreaterThan(0);
    expect.soft(Number(q("#rc-clip-wide rect").getAttribute("width"))).toBeLessThan(752);
    frames.splice(0).forEach((f) => f(9000));
    expect.soft(g.hasAttribute("clip-path")).toBe(false);
    expect.soft(q("[data-chart] clipPath")).toBeNull();
    globalThis.requestAnimationFrame = old;
  });

  it("follows typed odds, a comma read as the decimal mark", () => {
    type(q("#pr-win"), "40");
    type(q("#pr-pay"), "200");
    const r = runOdds(40, 200);
    expect.soft(q("[data-say]").textContent).toBe(sayText(r, 10));
    expect.soft(q("#pr-pay-n").textContent).toBe(payoffNote(r));
    type(q("#pr-win"), "55,5");
    expect.soft(api.state().odds.P).toBe(555);
  });

  it("marks only the bad box and keeps the last good result", () => {
    const before = q("[data-say]").textContent;
    type(q("#pr-win"), "100");
    expect.soft(q("[data-field=win]").classList.contains("bad")).toBe(true);
    expect.soft(q("#pr-win").getAttribute("aria-invalid")).toBe("true");
    expect.soft(q("#pr-win-n").textContent).toBe(WIN_MESSAGE);
    expect.soft(q("[data-field=payoff]").classList.contains("bad")).toBe(false);
    expect.soft(q("[data-say]").textContent).toBe(before);
    for (const bad of ["", "abc", "-5", "1e2", "1,250"]) {
      type(q("#pr-pay"), bad);
      expect.soft(q("#pr-pay-n").textContent, bad).toBe(PAYOFF_MESSAGE);
      expect.soft(q("[data-say]").textContent, bad).toBe(before);
    }
    type(q("#pr-win"), "60");
    type(q("#pr-pay"), "100");
    expect.soft(q("[data-field=win]").classList.contains("bad")).toBe(false);
    expect.soft(q("#pr-win-n").textContent).toBe(winNote(runOdds(60, 100)));
  });

  it("refuses a payoff typed as 1,000 with a message that writes the limit as 1000%", () => {
    type(q("#pr-pay"), "1,000");
    expect.soft(q("#pr-pay-n").textContent).toBe(PAYOFF_MESSAGE);
    expect.soft(PAYOFF_MESSAGE).toContain("1000%");
    type(q("#pr-pay"), "1000");
    expect.soft(q("[data-field=payoff]").classList.contains("bad")).toBe(false);
  });

  it("deals another example into both boxes and keeps the size", () => {
    type(q("#pr-size"), "20");
    click(q("[data-another]"));
    const k = api.state().example;
    expect.soft(k).not.toBe(0);
    expect.soft(q("#pr-win").value).toBe(String(EXAMPLES[k].win));
    expect.soft(q("#pr-pay").value).toBe(String(EXAMPLES[k].payoff));
    expect.soft(api.state().size).toBe(20);
    expect.soft(q("[data-say]").textContent).toBe(sayText(runOdds(EXAMPLES[k].win, EXAMPLES[k].payoff), 20));
  });

  it("does nothing on a page without its controls", () => {
    document.body.innerHTML = "<div data-ruin></div>";
    expect(init(document.querySelector("[data-ruin]"))).toBeNull();
  });
});
