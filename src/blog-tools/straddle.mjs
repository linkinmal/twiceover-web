/**
 * straddle — the math behind "Implied move from a straddle" (ai-team/design/blog-handoff-playables.md section 2;
 * reference artifact blog-straddle-2026-10-12.html).
 *
 * Implied move = straddle price / stock price. The two breakevens are the stock price plus and minus the straddle
 * price. On its last day a long straddle gains |ending price − stock price| − straddle price per share, a loss of the
 * straddle price at the most.
 *
 * Every price is held as whole cents and every comparison and the one division are done in integers, so the percent
 * never lands on the wrong side of a tie (9.10 over 200 is exactly 4.55%) and a figure printed to one decimal agrees
 * with the one compared. A profit in cents a share is also the profit in dollars a contract (100 shares).
 *
 * Pure functions, no DOM and no clock: the build imports this to print the page's opening state and the block script
 * in `public/js/` imports it to recompute on input, so both print the same numbers. Wording is in straddle-view.mjs.
 */

/** The page opens on the first; "Try another example" deals one of the other five (blog-handoff-playables.md section 2). */
export const EXAMPLES = Object.freeze([
  { stock: 100, straddle: 9 },
  { stock: 100, straddle: 3.5 },
  { stock: 50, straddle: 3 },
  { stock: 250, straddle: 11.25 },
  { stock: 40, straddle: 4.4 },
  { stock: 180, straddle: 6.3 },
].map((e) => Object.freeze(e)));
export const DEFAULT_EXAMPLE = 0;

/** A price above this is refused, so a huge typed number cannot break the chart (the overnight call page caps at the same figure). */
export const MAX_PRICE = 100000;

/** The slider moves by 50 cents at a stock price of $100 and above, else by 25 cents (by one cent when the straddle price is under one such step). */
export const SLIDER_STEP_AT = 10000;

/** A typed price as whole cents. Trimming to 12 significant digits keeps 9.005 (binary 9.00499…) at 901, and 0.1 + 0.2 at 30. */
export const centsOf = (x) => Math.round(Number((x * 100).toPrecision(12)));

export const STOCK_MESSAGE = "Type a price above zero and up to $100,000. Showing the last good result.";
export const STRADDLE_MESSAGE = "Type a price above zero and below the stock price. Showing the last good result.";

/**
 * Which typed boxes are bad. A stock price that is blank, zero, negative or past the cap marks the stock box; a straddle
 * price that is blank, zero or negative, or at or above the stock price, marks the straddle box. A bad stock price is
 * never the yardstick for the straddle's. Comparisons are in cents.
 * @returns {{ok: boolean, errors: {stock?: string, straddle?: string}}}
 */
export function validateStraddle(stock, straddle) {
  const sc = centsOf(stock);
  const pc = centsOf(straddle);
  const stockBad = !(sc > 0 && sc <= MAX_PRICE * 100);
  const straddleBad = !(pc > 0 && pc <= MAX_PRICE * 100) || (!stockBad && pc >= sc);
  const errors = {};
  if (stockBad) errors.stock = STOCK_MESSAGE;
  if (straddleBad) errors.straddle = STRADDLE_MESSAGE;
  return { ok: !stockBad && !straddleBad, errors };
}

/**
 * @param {number} stock dollars a share
 * @param {number} straddle dollars a share, the call and the put together
 */
export function runStraddle(stock, straddle) {
  const check = validateStraddle(stock, straddle);
  if (!check.ok) return { ok: false, errors: check.errors };
  const stockC = centsOf(stock);
  const straddleC = centsOf(straddle);
  return {
    ok: true,
    stockC,
    straddleC,
    /** the implied move in tenths of a percent, half rounding up: straddle over stock × 1000 */
    impliedTenths: Math.floor((2000 * straddleC + stockC) / (2 * stockC)),
    lowC: stockC - straddleC,
    highC: stockC + straddleC,
    contractDollars: straddleC,
  };
}

/** Profit or loss at an ending price, in cents a share (equal to dollars a contract). */
export function profitAt(r, endC) {
  const cents = Math.abs(endC - r.stockC) - r.straddleC;
  return { cents, contractDollars: cents, kind: cents > 0 ? "gain" : cents < 0 ? "loss" : "even" };
}

/**
 * The slider's range: up to two straddle prices either side of the stock price, never below a cent, and cut to whole
 * steps from the stock price so the stock price itself is always a position the slider can hold (a range that started
 * a few cents off the step grid would show the thumb a step away from the price the page prints).
 */
export function sliderBounds(r) {
  const base = r.stockC >= SLIDER_STEP_AT ? 50 : 25;
  const stepC = 2 * r.straddleC < 2 * base ? 1 : base;
  const below = Math.floor((r.stockC - Math.max(1, r.stockC - 2 * r.straddleC)) / stepC);
  const above = Math.floor((2 * r.straddleC) / stepC);
  return { minC: r.stockC - below * stepC, maxC: r.stockC + above * stepC, stepC };
}

/** A stored ending price kept on the slider: inside its range and on its step grid, so the page and the thumb print one price. */
export function fitEnd(r, endC) {
  const { minC, maxC, stepC } = sliderBounds(r);
  const clamped = Math.min(maxC, Math.max(minC, endC));
  return minC + Math.round((clamped - minC) / stepC) * stepC;
}
