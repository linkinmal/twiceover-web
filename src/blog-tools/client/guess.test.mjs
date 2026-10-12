// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { init } from "./guess.mjs";
import { QUESTION, answerHtml, endTitle, givenHtml, lessonBig, meterHtml, tallyHtml, whyText } from "../guess-gap-view.mjs";

// Invented figures; the baked-in set is checked in guess-gap-reports.test.mjs.
const FIRST = [
  { company: "Sample Co. A", date: "2025-07-24", pricedTenths: 51, movedTenths: 112 },
  { company: "Sample Co. B", date: "2025-07-30", pricedTenths: 74, movedTenths: -30 },
  { company: "Sample Co. C", date: "2025-08-05", pricedTenths: 42, movedTenths: 11 },
  { company: "Sample Co. D", date: "2025-08-21", pricedTenths: 90, movedTenths: -146 },
  { company: "Sample Co. E", date: "2025-09-04", pricedTenths: 63, movedTenths: 58 },
];
const SETS = [FIRST, FIRST.map((r, k) => ({ ...r, company: `Second ${k}`, movedTenths: -r.movedTenths }))];

// The served markup the page carries, reduced to what the script touches: the first question, the answers and the lesson.
function served() {
  const s = SETS[0];
  document.body.innerHTML = `<div data-guess>
    <p><span data-rno>Report 1 of 5</span><span data-rsc>Score so far: none yet</span></p>
    <div data-round>
      <h2 data-q>${QUESTION}</h2><p data-given>${givenHtml(s[0])}</p>
      <div data-js hidden><output data-gv>5.0%</output><input type="range" id="gg-guess" min="0" max="30" step="0.5" value="5"></div>
      <div data-js hidden><button data-lock>Lock</button><button data-skip>Skip</button></div>
      <div data-rev hidden><p data-ans></p><div data-meter></div><p data-why></p><button data-next>Next report</button></div>
    </div>
    <div data-end data-nojs><h2 data-eq>${endTitle([])}</h2><div data-score></div><table data-tally>${tallyHtml(s, [])}</table><div data-js hidden><button data-again>Play five more</button></div></div>
    <section data-lesson data-nojs><p data-lbig>${lessonBig(s)}</p><div data-bars></div></section>
  </div>`;
  return document.querySelector("[data-guess]");
}
// What the browser's parser makes of table rows, so a served string and one the script wrote compare like for like.
const parsedRows = (rows) => {
  const el = document.createElement("table");
  el.innerHTML = rows;
  return el.innerHTML;
};
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const slide = (el, v) => {
  el.value = String(v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};

describe("the Guess the gap block script", () => {
  let root;
  let api;
  const q = (s) => root.querySelector(s);
  const play = (guesses) => {
    for (const v of guesses) {
      slide(q("#gg-guess"), v);
      click(q("[data-lock]"));
      click(q("[data-next]"));
    }
  };
  beforeEach(() => {
    root = served();
    api = init(root, { sets: SETS });
  });

  it("shows the question and the slider, hides the printed answers and lesson", () => {
    expect.soft(q("[data-end]").hidden).toBe(true);
    expect.soft(q("[data-lesson]").hidden).toBe(true);
    expect.soft(q("[data-round]").hidden).toBe(false);
    expect.soft(q("[data-q]").textContent).toBe(QUESTION);
    expect.soft(q("[data-given]").innerHTML).toBe(givenHtml(SETS[0][0]));
    expect.soft(q("#gg-guess").value).toBe("5");
    expect.soft([...root.querySelectorAll("[data-js]")].every((n) => !n.hidden)).toBe(true);
  });

  it("reads the slider out as a percent as it moves", () => {
    slide(q("#gg-guess"), 12.5);
    expect(q("[data-gv]").textContent).toBe("12.5%");
  });

  it("locks the guess: the answer, the one-scale meter and the why sentence, the slider no longer movable", () => {
    slide(q("#gg-guess"), 11);
    click(q("[data-lock]"));
    const r = SETS[0][0];
    expect.soft(q("[data-ans]").innerHTML).toBe(answerHtml(r));
    expect.soft(q("[data-why]").textContent).toBe(whyText(r, 110));
    expect.soft(q("[data-meter]").innerHTML).toBe(meterHtml(r, 110));
    expect.soft(q("#gg-guess").disabled).toBe(true);
    expect.soft(q("[data-rev]").hidden).toBe(false);
    expect.soft(q("[data-lock]").hidden).toBe(true);
    expect.soft(q("[data-skip]").hidden).toBe(true);
    expect.soft(document.activeElement).toBe(q("[data-next]"));
    expect.soft(api.state().guesses).toEqual([110]);
  });

  it("goes report to report, scores the visit and ends with the answers table and the lesson", () => {
    play([11, 5, 8, 12]);
    expect.soft(q("[data-rno]").textContent).toBe("Report 5 of 5");
    expect.soft(q("[data-rsc]").textContent).toBe("Score so far: 2 of 4 hits");
    slide(q("#gg-guess"), 6);
    click(q("[data-lock]"));
    expect.soft(q("[data-next]").textContent).toBe("See my score");
    click(q("[data-next]"));
    expect.soft(q("[data-rno]").textContent).toBe("Game over");
    expect.soft(q("[data-rsc]").textContent).toBe("Score: 3 of 5 hits");
    expect.soft(q("[data-eq]").textContent).toBe("Your five guesses");
    expect.soft(q("[data-score]").innerHTML).toContain("<b>3 of 5</b>");
    expect.soft(q("[data-tally]").innerHTML).toBe(parsedRows(tallyHtml(SETS[0], [110, 50, 80, 120, 60])));
    expect.soft(q("[data-lbig]").textContent).toBe(lessonBig(SETS[0]));
    expect.soft(q("[data-end]").hidden).toBe(false);
    expect.soft(q("[data-lesson]").hidden).toBe(false);
    expect.soft(q("[data-round]").hidden).toBe(true);
    expect.soft(document.activeElement).toBe(q("[data-eq]"));
  });

  it("skips straight to all five answers with no score", () => {
    click(q("[data-skip]"));
    expect.soft(q("[data-eq]").textContent).toBe("All five answers");
    expect.soft(q("[data-rsc]").textContent).toBe("No guesses made");
    expect.soft(q("[data-score]").innerHTML).toBe("");
    expect.soft(q("[data-tally]").innerHTML).toBe(parsedRows(tallyHtml(SETS[0], [])));
  });

  it("deals the next five on Play five more, back to the first after the last, with the score cleared", () => {
    play([11, 5, 8, 12, 6]);
    click(q("[data-again]"));
    expect.soft(api.state()).toMatchObject({ setIdx: 1, i: 0, guesses: [] });
    expect.soft(q("[data-given]").innerHTML).toBe(givenHtml(SETS[1][0]));
    expect.soft(q("[data-rsc]").textContent).toBe("Score so far: none yet");
    expect.soft(q("[data-end]").hidden).toBe(true);
    expect.soft(q("#gg-guess").disabled).toBe(false);
    play([1, 1, 1, 1, 1]);
    click(q("[data-again]"));
    expect.soft(api.state().setIdx).toBe(0);
  });
});
