/**
 * straddle-view — the words and the picture of "Implied move from a straddle" (blog-handoff-playables.md section 2).
 * The build imports these to print the opening example and the block script imports them to print the reader's, so
 * a reader with script off and a reader with script on see the same sentences. The wording is the artifact's
 * (blog-straddle-2026-10-12.html); Growth sets the final words. Every figure comes from straddle.mjs, in cents.
 */
import { profitAt, sliderBounds } from "./straddle.mjs";

export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
export const percent = (tenths) => `${(tenths / 10).toFixed(1)}%`;
const f = (n) => String(Math.round(n * 10) / 10);

export const STOCK_NOTE = "What one share costs.";

export function straddleNote(r) {
  return `The call's price plus the put's price. A ${money(r.straddleC)} straddle costs $${r.contractDollars} for one contract.`;
}

export function answerHtml(r) {
  return (
    `<div><b>${percent(r.impliedTenths)}</b><span>implied move, up or down</span></div>` +
    `<div><b>${money(r.lowC)} to ${money(r.highC)}</b><span>the range it draws</span></div>` +
    `<div><b>${money(r.straddleC)}</b><span>what the straddle costs per share</span></div>`
  );
}

export function sayText(r) {
  return `The straddle costs ${money(r.straddleC)} for a ${money(r.stockC)} stock, so the market is pricing a move of about ${percent(r.impliedTenths)}. The stock has to end below ${money(r.lowC)} or above ${money(r.highC)} for the straddle to make money.`;
}

/** The result at the slider's price, said in words as well as the gain and loss colours. */
export function resultHtml(r, endC) {
  const p = profitAt(r, endC);
  const abs = Math.abs(p.cents);
  if (p.kind === "even") return `Stock ends at ${money(endC)}: <span>$0.00 (breakeven)</span>.`;
  const cls = p.kind === "gain" ? "pos" : "neg";
  return `Stock ends at ${money(endC)}: <span class="${cls}">${p.kind} ${money(abs)} a share, $${abs} a contract</span>.`;
}

/** The slider's attributes as strings, in dollars. */
export function sliderText(r, endC) {
  const b = sliderBounds(r);
  return {
    min: (b.minC / 100).toFixed(2),
    max: (b.maxC / 100).toFixed(2),
    step: String(b.stepC / 100),
    value: (endC / 100).toFixed(2),
    valuetext: money(endC),
  };
}

export const chartLabel = (r) =>
  `Profit or loss of the straddle on its last day at each stock price. The shaded band runs from ${money(r.lowC)} to ${money(r.highC)}, the implied move.`;

/**
 * The chart's inside, for a 640 by 250 box: the shaded implied-move band, the zero line, the V the straddle makes
 * on its last day, the two dashed breakevens with their prices, the strike, the most it can lose, and a handle at
 * the slider's ending price. Colours come from the page's theme through classes.
 */
export function chartSvg(r, endC) {
  const { minC, maxC } = sliderBounds(r);
  const top = r.straddleC;
  const bot = -r.straddleC;
  const X = (v) => f(50 + ((Math.min(maxC, Math.max(minC, v)) - minC) / (maxC - minC)) * 560);
  const Y = (v) => f(20 + ((top - v) / (top - bot)) * 180);
  const pl = (v) => Math.abs(v - r.stockC) - r.straddleC;
  const y0 = Y(0);
  const lo = X(r.lowC);
  const hi = X(r.highC);
  const handleY = Y(Math.max(bot, Math.min(top, pl(endC))));
  return (
    `<rect class="sd-band" x="${lo}" y="20" width="${f(hi - lo)}" height="180"/>` +
    `<line class="sd-zero" x1="50" x2="610" y1="${y0}" y2="${y0}"/>` +
    `<polyline class="l2" fill="none" points="${X(minC)},${Y(pl(minC))} ${X(r.stockC)},${Y(bot)} ${X(maxC)},${Y(pl(maxC))}"/>` +
    `<line class="gd" x1="${lo}" x2="${lo}" y1="20" y2="200"/><line class="gd" x1="${hi}" x2="${hi}" y1="20" y2="200"/>` +
    `<text class="ax" x="${lo}" y="216" text-anchor="middle">${money(r.lowC)}</text><text class="ax" x="${hi}" y="216" text-anchor="middle">${money(r.highC)}</text>` +
    `<text class="ax" x="${X(r.stockC)}" y="236" text-anchor="middle">strike ${money(r.stockC)}</text>` +
    `<text class="ax" x="52" y="${f(Number(y0) - 6)}">break even</text>` +
    `<text class="ax sd-lose" x="52" y="194">most you can lose: ${money(r.straddleC)} a share</text>` +
    `<circle class="sd-hd" cx="${X(endC)}" cy="${handleY}" r="8"/>`
  );
}
