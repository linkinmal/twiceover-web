// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { init } from "./client.mjs";
import { EXAMPLES, PAYOFF_MESSAGE, WIN_MESSAGE, runOdds } from "./position-size.mjs";
import { answerHtml, barsHtml, firstTradeText, payoffNote, sayText, winNote } from "./position-size-view.mjs";

// The served markup the page carries, reduced to what the script touches: the opening example printed by the build.
function served() {
  const r = runOdds(EXAMPLES[0].win, EXAMPLES[0].payoff);
  document.body.innerHTML = `<div data-ruin>
    <p data-nojs>The example</p>
    <p data-say>${sayText(r, 10)}</p>
    <div data-ans>${answerHtml(r, 10)}</div>
    <div data-js hidden><input type="range" id="pr-size" min="1" max="100" step="1" value="10"></div>
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
