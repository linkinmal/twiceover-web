/**
 * Block script for "Guess the gap" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to public/js/blog-guess-the-gap.js. The
 * page carries the first question, all five answers and the lesson already (printed at build); this script turns them
 * into the game: one report at a time, a slider and a lock, the answer on one scale with a sentence that says why, then
 * the score and the lesson. The reports are the set baked into the bundle. Nothing is sent, stored or read from the
 * address; the score lasts until the reader leaves the page.
 */
import { MAX_TENTHS, SET_SIZE, STEP_TENTHS } from "./guess-gap.mjs";
import { REPORT_SETS } from "./guess-gap-reports.mjs";
import { QUESTION, answerHtml, barsHtml, endTitle, givenHtml, lessonBig, meterHtml, percent, reportLine, scoreHtml, scoreLine, scoreResultLine, tallyHtml, whyText } from "./guess-gap-view.mjs";

const START_TENTHS = 50;

/**
 * @param {Element} root the [data-guess] element
 * @param {{sets?: typeof REPORT_SETS}} [opts]
 */
export function init(root, opts = {}) {
  const sets = opts.sets ?? REPORT_SETS;
  const q = (s) => root.querySelector(s);
  const slider = q("#gg-guess");
  const round = q("[data-round]");
  const end = q("[data-end]");
  const lesson = q("[data-lesson]");
  if (!slider || !round || !end || !lesson) return null;

  let setIdx = 0;
  let i = 0;
  let g = [];
  const set = () => sets[setIdx];
  const tenths = () => Math.round(parseFloat(slider.value) * 10);

  root.querySelectorAll("[data-js]").forEach((n) => (n.hidden = false));
  root.querySelectorAll("[data-nojs]").forEach((n) => (n.hidden = true));
  slider.max = String(MAX_TENTHS / 10);
  slider.step = String(STEP_TENTHS / 10);

  function show() {
    const s = set();
    q("[data-rno]").textContent = reportLine(i, s.length);
    q("[data-rsc]").textContent = scoreLine(s, g);
    q("[data-q]").textContent = QUESTION;
    q("[data-given]").innerHTML = givenHtml(s[i]);
    slider.value = String(START_TENTHS / 10);
    slider.disabled = false;
    q("[data-gv]").textContent = percent(START_TENTHS);
    q("[data-lock]").hidden = false;
    q("[data-skip]").hidden = false;
    q("[data-rev]").hidden = true;
    round.hidden = false;
    end.hidden = true;
    lesson.hidden = true;
  }

  function lock() {
    const r = set()[i];
    const v = tenths();
    g[i] = v;
    slider.disabled = true;
    q("[data-lock]").hidden = true;
    q("[data-skip]").hidden = true;
    q("[data-ans]").innerHTML = answerHtml(r);
    q("[data-meter]").innerHTML = meterHtml(r, v);
    q("[data-why]").textContent = whyText(r, v);
    const next = q("[data-next]");
    next.textContent = i === set().length - 1 ? "See my score" : "Next report";
    q("[data-rev]").hidden = false;
    next.focus();
  }

  function finish() {
    const s = set();
    round.hidden = true;
    end.hidden = false;
    lesson.hidden = false;
    q("[data-rno]").textContent = "Game over";
    q("[data-rsc]").textContent = scoreResultLine(s, g);
    const title = q("[data-eq]");
    title.textContent = endTitle(g);
    q("[data-score]").innerHTML = scoreHtml(s, g);
    q("[data-tally]").innerHTML = tallyHtml(s, g);
    q("[data-lbig]").textContent = lessonBig(s);
    q("[data-bars]").innerHTML = barsHtml(s);
    title.setAttribute("tabindex", "-1");
    title.focus();
  }

  slider.addEventListener("input", () => (q("[data-gv]").textContent = percent(tenths())));
  q("[data-lock]").addEventListener("click", lock);
  q("[data-skip]").addEventListener("click", finish);
  q("[data-next]").addEventListener("click", () => {
    if (i === set().length - 1) return finish();
    i++;
    show();
    slider.focus();
  });
  q("[data-again]").addEventListener("click", () => {
    setIdx = (setIdx + 1) % sets.length;
    i = 0;
    g = [];
    show();
    slider.focus();
  });

  show();
  return { state: () => ({ setIdx, i, guesses: g.slice(), size: SET_SIZE }) };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-guess]")) init(root);
}
