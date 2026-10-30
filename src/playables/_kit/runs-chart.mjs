/**
 * runs-chart — the blog kit's runs chart (blog-handoff-playables.md §0, v1.4; build reference
 * ai-team/design/assets/blog-runs-chart-2026-10-30.html in stock-analyst-platform, where the artifact governs).
 *
 * Thirty paths of one account over 100 trades on a log scale from ¼× to 8× the start, the same thirty fixed coin flips
 * at every size. A run that falls to half the start stops on the half line with a dot; a run that ends above the start
 * is ahead; any other run is neither. The tally counts only these thirty drawn runs, so it can differ from the exact
 * odds the sentence above the chart gives (those come from outcomes() in the page's own math module).
 *
 * Pure functions, no DOM and no clock: the build imports this to print the opening state and the block script imports
 * it to redraw, so a reader with script off and a reader with script on see the same paths. Colours are the kit's
 * (gain, loss, ink, the ochre accent) through the classes in src/styles/blog.css; nothing here names a colour.
 */

export const RUNS = 30;
export const TRADES = 100;

/** The two drawings the page prints: the column's width, and one column at 390. The kit's 560px query shows one. */
export const VIEWS = Object.freeze({
  wide: Object.freeze({ id: "wide", w: 752, h: 300 }),
  narrow: Object.freeze({ id: "narrow", w: 358, h: 230 }),
});

const LEFT = 56;
const RIGHT = 12;
const TOP = 12;
const BOTTOM = 26;
const V_MIN = 0.25;
const V_MAX = 8;

// The rule the page's exact odds use (position-size.mjs outcomes()): half is -ln 2, compared in logs with a small
// tolerance, so a run that lands exactly on half counts as at half.
const HALF = -Math.LN2;
const EPS = 1e-9;

/** The artifact's generator (mulberry32, seed 7), run once at import: thirty sequences of 100 uniform numbers. */
function makeFlips() {
  let seed = 7;
  const next = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: RUNS }, () => Array.from({ length: TRADES }, next));
}
export const FLIPS = makeFlips();

/**
 * The thirty runs at one size. A flip below the win chance is a win (the account times 1 + f·b), else a loss (times
 * 1 − f). A run that reaches half stops there: its last point is pinned to exactly one half, on the half line.
 * @param {{P:number, B:number}} r the odds from runOdds, in tenths of a percent
 * @param {number} size the share of the account risked on each trade, in whole percent
 * @returns {{kind:"ahead"|"neither"|"half", pts:[number, number][]}[]} points are [trade, account as a multiple of the start]
 */
export function drawRuns(r, size) {
  const p = r.P / 1000;
  const f = size / 100;
  const up = Math.log1p(f * (r.B / 1000));
  const down = f >= 1 ? -Infinity : Math.log1p(-f);
  return FLIPS.map((flips) => {
    const pts = [[0, 1]];
    let level = 0;
    let kind = null;
    for (let n = 1; n <= TRADES; n++) {
      level += flips[n - 1] < p ? up : down;
      if (level <= HALF + EPS) {
        pts.push([n, 0.5]);
        kind = "half";
        break;
      }
      pts.push([n, Math.exp(level)]);
    }
    return { kind: kind ?? (level > EPS ? "ahead" : "neither"), pts };
  });
}

/** How many of the drawn runs ended ahead, fell to half, or ended in between. */
export function tally(runs) {
  const t = { ahead: 0, neither: 0, half: 0 };
  for (const run of runs) t[run.kind]++;
  return t;
}

/** The lines the account axis carries, and the lowest label, from a start in whole dollars. */
export function axisLabels(start) {
  const money = (v) => `$${(v * start).toLocaleString("en-US")}`;
  return [V_MIN, 0.5, 1, 2, 4, 8].map((v) => ({ v, text: money(v), line: v !== V_MIN }));
}

/** The text alternative: the sentence and the tally the page printed beside the chart. */
export const chartLabel = (size, sentence, tallyText) => `Thirty account paths over ${TRADES} trades at a ${size}% size. ${sentence} ${tallyText}`;

const KIND_CLASS = { ahead: "rc-g", neither: "rc-n", half: "rc-l" };
// Red under green, so the runs that fell stay visible.
const DRAW_ORDER = { half: 0, neither: 1, ahead: 2 };

/**
 * The chart as SVG markup (the inside of an <svg viewBox="0 0 w h">). Coordinates are rounded to a tenth of a pixel, and every element is closed, so the markup is what the DOM serializes back.
 * @param {ReturnType<typeof drawRuns>} runs
 * @param {{w:number, h:number}} view
 * @param {number} [start] the account every run starts with, in whole dollars, for the axis
 */
export function chartSvg(runs, view, start = 10000) {
  const { w, h } = view;
  const x = (n) => LEFT + (n / TRADES) * (w - LEFT - RIGHT);
  const y = (v) => {
    const c = Math.min(V_MAX, Math.max(V_MIN, v));
    return TOP + (1 - (Math.log(c) - Math.log(V_MIN)) / (Math.log(V_MAX) - Math.log(V_MIN))) * (h - TOP - BOTTOM);
  };
  const t = (n) => n.toFixed(1);
  let out = "";
  for (const a of axisLabels(start)) {
    const cls = a.v === 0.5 ? "rc-half" : a.v === 1 ? "rc-start" : "rc-grid";
    if (a.line) out += `<line class="${cls}" x1="${LEFT}" x2="${t(w - RIGHT)}" y1="${t(y(a.v))}" y2="${t(y(a.v))}"></line>`;
    out += `<text class="rc-ax${a.v === 0.5 ? " rc-axl" : ""}" x="${LEFT - 6}" y="${t(y(a.v) + 4)}" text-anchor="end">${a.text}</text>`;
  }
  out += `<text class="rc-ax rc-axl" x="${t(w - RIGHT)}" y="${t(y(0.5) - 5)}" text-anchor="end">half</text>`;
  for (const n of [0, 25, 50, 75, 100]) {
    out += `<text class="rc-ax" x="${t(x(n))}" y="${h - 8}" text-anchor="${n === 0 ? "start" : n === 100 ? "end" : "middle"}">${n === 100 ? "100 trades" : n}</text>`;
  }
  let off = false;
  const ordered = [...runs].sort((a, b) => DRAW_ORDER[a.kind] - DRAW_ORDER[b.kind]);
  out += `<g class="rc-runs">`;
  for (const run of ordered) {
    if (run.pts.some((p) => p[1] > V_MAX)) off = true;
    out += `<path class="${KIND_CLASS[run.kind]}" d="M${run.pts.map((p) => `${t(x(p[0]))},${t(y(p[1]))}`).join("L")}"></path>`;
    if (run.kind === "half") {
      const last = run.pts.at(-1);
      out += `<circle class="rc-dot" cx="${t(x(last[0]))}" cy="${t(y(last[1]))}" r="2.6"></circle>`;
    }
  }
  out += `</g>`;
  if (off) out += `<text class="rc-ax" x="${t(w - RIGHT)}" y="${TOP + 11}" text-anchor="end">off the chart ↑</text>`;
  return out;
}
