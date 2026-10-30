/**
 * Block script for "Position size and risk of ruin" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to
 * public/js/blog-position-size-and-risk-of-ruin.js. It reads the page's own slider and two typed boxes, runs the shared
 * math and writes the same sentence, runs chart, tally, answers and bars the build printed (position-size-view.mjs) back
 * into the page. The one slider drives all of them; Replay draws the thirty paths again, left to right.
 * A bad entry marks its own box and the page keeps the last good result. Nothing is sent, stored or read from the address.
 */
import { DEFAULT_EXAMPLE, DEFAULT_SIZE, EXAMPLES, fitSize, outcomes, runOdds, validateOdds } from "./position-size.mjs";
import { readNumber } from "../_kit/number-input.mjs";
import { answerHtml, barsHtml, chartParts, firstTradeText, payoffNote, sayText, sliderText, tickLeft, tickNote, tickSize, winNote } from "./position-size-view.mjs";

const REPLAY_MS = 1600;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /** Draws the paths left to right by opening a clip over them; with reduced motion the chart is simply redrawn at rest. */
  function replay() {
    draw();
    if (reduced()) return;
    for (const svg of root.querySelectorAll("[data-chart] svg")) {
      const g = svg.querySelector(".rc-runs");
      const [, , vw, vh] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
      if (!g || !vw) continue;
      const id = `rc-clip-${svg.dataset.view}`;
      const NS = "http://www.w3.org/2000/svg";
      const clip = document.createElementNS(NS, "clipPath");
      clip.id = id;
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("height", String(vh));
      rect.setAttribute("width", "0");
      clip.appendChild(rect);
      svg.insertBefore(clip, g);
      g.setAttribute("clip-path", `url(#${id})`);
      // The first frame's own timestamp starts the clock: it can be earlier than performance.now() at the click.
      let t0 = null;
      const step = (now) => {
        t0 ??= now;
        const k = Math.min(1, (now - t0) / REPLAY_MS);
        rect.setAttribute("width", String(vw * k));
        if (k < 1 && clip.isConnected) requestAnimationFrame(step);
        else {
          g.removeAttribute("clip-path");
          clip.remove();
        }
      };
      requestAnimationFrame(step);
    }
  }

  function draw() {
    const o = outcomes(r, size);
    const c = chartParts(r, size, o);
    for (const svg of root.querySelectorAll("[data-chart] svg")) {
      svg.innerHTML = c[svg.dataset.view];
      svg.setAttribute("aria-label", c.label);
    }
    q("[data-tally]").textContent = c.tally;
    q("[data-read]").textContent = `${size}%`;
    const tick = tickSize(r);
    const tickEl = q("[data-tick]");
    tickEl.hidden = tick === null;
    if (tick !== null) tickEl.style.left = tickLeft(tick);
    q("[data-tick-note]").textContent = tickNote(r);
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
  q("[data-replay]").addEventListener("click", replay);

  draw();
  return { state: () => ({ example, size, odds: r }) };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-ruin]")) init(root);
}
