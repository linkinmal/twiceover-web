/**
 * Block script for "Position size and risk of ruin" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to
 * public/js/blog-position-size-and-risk-of-ruin.js. It reads the page's own slider and two typed boxes, runs the shared
 * math and writes the same sentence, answers and bars the build printed (position-size-view.mjs) back into the page.
 * A bad entry marks its own box and the page keeps the last good result. Nothing is sent, stored or read from the address.
 */
import { DEFAULT_EXAMPLE, DEFAULT_SIZE, EXAMPLES, fitSize, outcomes, runOdds, validateOdds } from "./position-size.mjs";
import { readNumber } from "../_kit/number-input.mjs";
import { answerHtml, barsHtml, firstTradeText, payoffNote, sayText, sliderText, winNote } from "./position-size-view.mjs";

/**
 * @param {Element} root the [data-ruin] element
 * @param {{random?: () => number}} [opts]
 */
export function init(root, opts = {}) {
  const q = (s) => root.querySelector(s);
  const random = opts.random ?? Math.random;
  const slider = q("#pr-size");
  const winBox = q("#pr-win");
  const payBox = q("#pr-pay");
  if (!slider || !winBox || !payBox) return null;

  let example = DEFAULT_EXAMPLE;
  let r = runOdds(EXAMPLES[example].win, EXAMPLES[example].payoff);
  let size = DEFAULT_SIZE;

  root.querySelectorAll("[data-js]").forEach((n) => (n.hidden = false));
  root.querySelectorAll("[data-nojs]").forEach((n) => (n.hidden = true));

  function draw() {
    const o = outcomes(r, size);
    q("[data-say]").textContent = sayText(r, size, o);
    q("[data-ans]").innerHTML = answerHtml(r, size, o);
    q("[data-bars]").innerHTML = barsHtml(r, size);
    q("[data-first]").textContent = firstTradeText(r, size);
    slider.value = sliderText(size).value;
    slider.setAttribute("aria-valuetext", sliderText(size).valuetext);
  }

  function mark(name, box, message) {
    const bad = Boolean(message);
    q(`[data-field=${name}]`).classList.toggle("bad", bad);
    box.setAttribute("aria-invalid", String(bad));
    q(`#${box.id}-n`).textContent = message ?? (name === "win" ? winNote(r) : payoffNote(r));
  }

  function read() {
    const win = readNumber(winBox.value);
    const payoff = readNumber(payBox.value);
    const check = validateOdds(win, payoff);
    if (check.ok) {
      r = runOdds(win, payoff);
      draw();
    }
    mark("win", winBox, check.errors.win);
    mark("payoff", payBox, check.errors.payoff);
  }

  function another() {
    const others = EXAMPLES.map((_, k) => k).filter((k) => k !== example);
    example = others[Math.min(others.length - 1, Math.floor(random() * others.length))];
    const e = EXAMPLES[example];
    winBox.value = String(e.win);
    payBox.value = String(e.payoff);
    r = runOdds(e.win, e.payoff);
    draw();
    mark("win", winBox);
    mark("payoff", payBox);
  }

  slider.addEventListener("input", () => {
    size = fitSize(parseFloat(slider.value));
    draw();
  });
  winBox.addEventListener("input", read);
  payBox.addEventListener("input", read);
  q("[data-another]").addEventListener("click", another);

  draw();
  return { state: () => ({ example, size, odds: r }) };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-ruin]")) init(root);
}
