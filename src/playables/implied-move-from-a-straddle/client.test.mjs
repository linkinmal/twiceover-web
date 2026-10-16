// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { init } from "./client.mjs";
import { EXAMPLES, runStraddle } from "./straddle.mjs";
import { answerHtml, chartSvg, chartSvgNarrow, resultHtml, sayText, straddleNote } from "./straddle-view.mjs";

// The served markup the page carries, reduced to what the script touches: the opening example printed by the build.
function served() {
  const r = runStraddle(EXAMPLES[0].stock, EXAMPLES[0].straddle);
  document.body.innerHTML = `<div data-straddle>
    <p data-nojs>needs script</p>
    <section data-js hidden>
      <input type="range" class="rng" id="sd-end" min="82.00" max="118.00" step="0.5" value="100.00">
      <button type="button" data-another>Try another example</button>
    </section>
    <p data-say>${sayText(r)}</p>
    <div data-ans>${answerHtml(r)}</div>
    <svg data-chart viewBox="0 0 640 250">${chartSvg(r, r.stockC)}</svg>
    <svg data-chart-narrow viewBox="0 0 320 224">${chartSvgNarrow(r, r.stockC)}</svg>
    <p data-res>${resultHtml(r, r.stockC)}</p>
    <section data-js hidden>
      <div data-field="stock"><input id="sd-stock" value="100.00" aria-describedby="sd-stock-n"><small id="sd-stock-n">What one share costs.</small></div>
      <div data-field="straddle"><input id="sd-strad" value="9.00" aria-describedby="sd-strad-n"><small id="sd-strad-n">${straddleNote(r)}</small></div>
    </section>
  </div>`;
  return document.querySelector("[data-straddle]");
}
// What the browser's parser makes of chart markup, so a served string and one the script wrote compare like for like.
const parsed = (svgInner) => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.innerHTML = svgInner;
  return el.innerHTML;
};
const type = (el, v) => {
  el.value = v;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

describe("the straddle block script", () => {
  let root;
  let api;
  const q = (s) => root.querySelector(s);
  beforeEach(() => {
    root = served();
    api = init(root, { random: () => 0.5 });
  });

  it("shows the controls and the typed boxes, hides the no-script line, and leaves the printed example as it was served", () => {
    const r = runStraddle(100, 9);
    expect.soft([...root.querySelectorAll("[data-js]")].every((n) => n.hidden === false)).toBe(true);
    expect.soft(q("[data-nojs]").hidden).toBe(true);
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(r));
    expect.soft(q("[data-say]").textContent).toBe(sayText(r));
    expect.soft(q("[data-res]").innerHTML).toBe(resultHtml(r, 10000));
    expect.soft(q("[data-chart]").innerHTML).toBe(parsed(chartSvg(r, 10000)));
    expect.soft(q("[data-chart-narrow]").innerHTML).toBe(parsed(chartSvgNarrow(r, 10000)));
    expect.soft(api.state().endC).toBe(10000);
  });

  it("moves the result and the handle when the slider moves, and leaves the answer alone", () => {
    const r = runStraddle(100, 9);
    type(q("#sd-end"), "115.00");
    expect.soft(q("[data-res]").innerHTML).toBe(resultHtml(r, 11500));
    expect.soft(q("[data-chart]").innerHTML).toBe(parsed(chartSvg(r, 11500)));
    expect.soft(q("[data-chart-narrow]").innerHTML).toBe(parsed(chartSvgNarrow(r, 11500)));
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(r));
    expect.soft(q("#sd-end").getAttribute("aria-valuetext")).toBe("$115.00");
  });

  it("recomputes every answer from the typed numbers, accepting a comma, and puts the slider back on the new stock price", () => {
    type(q("#sd-end"), "110.00");
    type(q("#sd-stock"), "50");
    type(q("#sd-strad"), "3,00");
    const r = runStraddle(50, 3);
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(r));
    expect.soft(q("[data-say]").textContent).toBe(sayText(r));
    expect.soft(api.state().endC).toBe(5000);
    expect.soft(q("#sd-end").min).toBe("44.00");
    expect.soft(q("#sd-end").max).toBe("56.00");
    expect.soft(q("#sd-end").step).toBe("0.25");
    expect.soft(q("#sd-strad-n").textContent).toBe(straddleNote(r));
  });

  it("marks only the bad box, says why in place, and keeps the last good result", () => {
    type(q("#sd-strad"), "100");
    const good = runStraddle(100, 9);
    expect.soft(q("[data-field=straddle]").classList.contains("bad")).toBe(true);
    expect.soft(q("#sd-strad").getAttribute("aria-invalid")).toBe("true");
    expect.soft(q("[data-field=stock]").classList.contains("bad")).toBe(false);
    expect.soft(q("#sd-strad-n").textContent).toBe("Type a price above zero and below the stock price. Showing the last good result.");
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(good));
    type(q("#sd-strad"), "9");
    expect.soft(q("[data-field=straddle]").classList.contains("bad")).toBe(false);
    expect.soft(q("#sd-strad").getAttribute("aria-invalid")).toBe("false");
    expect.soft(q("#sd-strad-n").textContent).toBe(straddleNote(good));
  });

  it("marks the stock box for a blank, zero, negative or typed-sign entry and does not move the slider", () => {
    for (const bad of ["", "0", "-5", "+5", "1e3", "abc"]) {
      type(q("#sd-stock"), bad);
      expect.soft(q("[data-field=stock]").classList.contains("bad"), JSON.stringify(bad)).toBe(true);
      expect.soft(q("[data-ans]").innerHTML, JSON.stringify(bad)).toBe(answerHtml(runStraddle(100, 9)));
    }
    type(q("#sd-stock"), "100");
    expect.soft(q("[data-field=stock]").classList.contains("bad")).toBe(false);
  });

  it("deals a different example each time, never the one on the page, and clears any mark on the boxes", () => {
    type(q("#sd-strad"), "");
    const seen = [];
    for (let i = 0; i < 8; i++) {
      const before = api.state().example;
      click(q("[data-another]"));
      const now = api.state().example;
      expect.soft(now, `deal ${i}`).not.toBe(before);
      seen.push(now);
    }
    expect.soft(seen.every((k) => k >= 0 && k < EXAMPLES.length)).toBe(true);
    const e = EXAMPLES[api.state().example];
    expect.soft(q("#sd-stock").value).toBe(e.stock.toFixed(2));
    expect.soft(q("#sd-strad").value).toBe(e.straddle.toFixed(2));
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(runStraddle(e.stock, e.straddle)));
    expect.soft(root.querySelectorAll(".bad")).toHaveLength(0);
  });

  it("can reach each of the other five examples, one for each fifth of the random source", () => {
    const reached = new Set();
    for (const u of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
      root = served();
      api = init(root, { random: () => u });
      click(q("[data-another]"));
      reached.add(api.state().example);
    }
    expect([...reached].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
