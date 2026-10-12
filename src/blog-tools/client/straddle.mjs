/**
 * Block script for "Implied move from a straddle" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to
 * public/js/blog-straddle.js. It reads the page's own slider and two typed boxes, runs the shared math and writes the
 * same sentences, answers and chart the build printed (straddle-view.mjs) back into the page. A bad entry marks its own
 * box and the page keeps the last good result. Nothing is sent, stored or read from the address.
 */
import { DEFAULT_EXAMPLE, EXAMPLES, fitEnd, runStraddle, validateStraddle } from "../straddle.mjs";
import { readNumber } from "../number-input.mjs";
import { STOCK_NOTE, answerHtml, chartLabel, chartSvg, resultHtml, sayText, sliderText, straddleNote } from "../straddle-view.mjs";

/**
 * @param {Element} root the [data-straddle] element
 * @param {{random?: () => number}} [opts]
 */
export function init(root, opts = {}) {
  const q = (s) => root.querySelector(s);
  const random = opts.random ?? Math.random;
  const slider = q("#sd-end");
  const stockBox = q("#sd-stock");
  const straddleBox = q("#sd-strad");
  const chart = q("[data-chart]");
  if (!slider || !stockBox || !straddleBox || !chart) return null;

  let example = DEFAULT_EXAMPLE;
  let r = runStraddle(EXAMPLES[example].stock, EXAMPLES[example].straddle);
  let endC = r.stockC;

  root.querySelectorAll("[data-js]").forEach((n) => (n.hidden = false));
  root.querySelectorAll("[data-nojs]").forEach((n) => (n.hidden = true));

  function drawResult() {
    q("[data-res]").innerHTML = resultHtml(r, endC);
    chart.innerHTML = chartSvg(r, endC);
    slider.setAttribute("aria-valuetext", sliderText(r, endC).valuetext);
  }

  function draw() {
    const s = sliderText(r, endC);
    q("[data-ans]").innerHTML = answerHtml(r);
    q("[data-say]").textContent = sayText(r);
    chart.setAttribute("aria-label", chartLabel(r));
    slider.min = s.min;
    slider.max = s.max;
    slider.step = s.step;
    slider.value = s.value;
    drawResult();
  }

  function mark(name, box, message) {
    const bad = Boolean(message);
    q(`[data-field=${name}]`).classList.toggle("bad", bad);
    box.setAttribute("aria-invalid", String(bad));
    q(`#${box.id}-n`).textContent = message ?? (name === "stock" ? STOCK_NOTE : straddleNote(r));
  }

  function read() {
    const stock = readNumber(stockBox.value);
    const straddle = readNumber(straddleBox.value);
    const check = validateStraddle(stock, straddle);
    if (check.ok) {
      const next = runStraddle(stock, straddle);
      endC = fitEnd(next, next.stockC !== r.stockC ? next.stockC : endC);
      r = next;
      draw();
    }
    mark("stock", stockBox, check.errors.stock);
    mark("straddle", straddleBox, check.errors.straddle);
  }

  function another() {
    const others = EXAMPLES.map((_, k) => k).filter((k) => k !== example);
    example = others[Math.min(others.length - 1, Math.floor(random() * others.length))];
    const e = EXAMPLES[example];
    stockBox.value = e.stock.toFixed(2);
    straddleBox.value = e.straddle.toFixed(2);
    r = runStraddle(e.stock, e.straddle);
    endC = r.stockC;
    draw();
    mark("stock", stockBox);
    mark("straddle", straddleBox);
  }

  slider.addEventListener("input", () => {
    endC = Math.round(parseFloat(slider.value) * 100);
    drawResult();
  });
  stockBox.addEventListener("input", read);
  straddleBox.addEventListener("input", read);
  q("[data-another]").addEventListener("click", another);

  draw();
  return { state: () => ({ example, endC, result: r }) };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-straddle]")) init(root);
}
