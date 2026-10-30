/**
 * position-size-view — the words of "Position size and risk of ruin" (definition.md beside this file). The build
 * imports these to print the opening example and the block script imports them to print the reader's, so a reader
 * with script off and a reader with script on see the same sentences. Every figure comes from position-size.mjs or
 * from the $10,000 start below, in whole cents.
 */
import { VIEWS, chartLabel, chartSvg, drawRuns, tally } from "../_kit/runs-chart.mjs";
import { SIZE_MAX, SIZE_MIN, barSizes, outcomes } from "./position-size.mjs";

const MINUS = "−";

/** The account every run starts with, and the line a run stops at (half of it), in cents. */
export const START_CENTS = 1000000;
export const FLOOR_CENTS = START_CENTS / 2;

/** Cents as dollars with separators: whole dollars bare, else two decimals. */
export function dollars(cents) {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const body = whole.toLocaleString("en-US") + (rest ? `.${String(rest).padStart(2, "0")}` : "");
  return `${cents < 0 ? MINUS : ""}$${body}`;
}
export const START = dollars(START_CENTS);
export const FLOOR = dollars(FLOOR_CENTS);

/** A number held in tenths, printed without a trailing ".0": 600 → "60", 555 → "55.5". */
const tenths = (t) => (t % 10 === 0 ? String(t / 10) : (t / 10).toFixed(1));

/**
 * A share of runs as the page prints it: whole percents, half up, with "under 1%" and "over 99%" at the ends, and 0%
 * or 100% only when the outcome cannot happen or always does (outcomes() works that out from the paths).
 * @param {{p:number, can:boolean, all:boolean}} o
 */
export function share(o) {
  if (!o.can) return "0%";
  if (o.all) return "100%";
  const pct = o.p * 100;
  if (pct < 0.5) return "under 1%";
  if (pct >= 99.5) return "over 99%";
  return `${Math.round(pct)}%`;
}

/** The edge in tenths of a percent, signed: "+20.0%", "−5.0%", "0.0%". */
export function edgeText(t) {
  const body = `${(Math.abs(t) / 10).toFixed(1)}%`;
  return t > 0 ? `+${body}` : t < 0 ? `${MINUS}${body}` : body;
}

export function kellyText(k) {
  return k.kind === "none" ? "none" : k.kind === "under" ? "under 1%" : `${k.pct}%`;
}

/** The edge in words: what a trade earns or loses, on average, for each $1 it risks (an edge of N% is N cents). */
export function edgeWords(r) {
  const t = r.edgeTenths;
  if (t === 0) return `Edge: ${edgeText(t)}. On average a trade earns nothing.`;
  const cents = `${tenths(Math.abs(t))} ${Math.abs(t) === 10 ? "cent" : "cents"}`;
  return `Edge: ${edgeText(t)}. On average a trade ${t > 0 ? "earns" : "loses"} ${cents} for each $1 it risks.`;
}

/**
 * The edge worked out in cents for the lesson at the top: a win chance p paying b wins p·b dollars and loses (1 − p)
 * per $1 risked, on average. P and B are tenths of a percent, so p·b in cents is P·B/10000, a multiple of 0.0001.
 */
export function edgeExplain(r) {
  const win = (r.P * r.B) / 10000;
  const loss = (1000 - r.P) / 10;
  const c = (x) => `${Number(x.toFixed(2))} cents`;
  return `Here a trade wins ${c(win)} and loses ${c(loss)} for each $1 it risks, on average. The difference, ${edgeText(r.edgeTenths)}, is the edge.`;
}

export const winNote = (r) => (r.P === 10 ? "1% means about 1 trade in 100 wins." : `${tenths(r.P)}% means about ${tenths(r.P)} trades in 100 win.`);
export const payoffNote = (r) => `At ${tenths(r.B)}%, a trade that risks $1,000 wins ${dollars(r.B * 100)}. ${edgeWords(r)}`;

/** The first trade at this size, from the $10,000 start. */
export function firstTradeText(r, size) {
  const risk = (START_CENTS * size) / 100;
  const win = (risk * r.B) / 1000;
  return `At ${size}%, the first trade risks ${dollars(risk)} of the ${START}. A win adds ${dollars(win)}, to ${dollars(START_CENTS + win)}. A loss takes ${dollars(risk)}, to ${dollars(START_CENTS - risk)}. Each later trade risks ${size}% of what the account holds then.`;
}

export function sayText(r, size, o = outcomes(r, size)) {
  const first = `Risking ${size}% on each trade, ${share(o.ahead)} of runs end above ${START} and ${share(o.floor)} fall to ${FLOOR} on the way.`;
  return r.positive ? first : `${first} With no positive edge, no size grows the account on average.`;
}

export function answerHtml(r, size, o = outcomes(r, size)) {
  return (
    `<div><b>${share(o.ahead)}</b><span>of runs end the 100 trades above ${START}</span></div>` +
    `<div><b>${share(o.floor)}</b><span>of runs fall to ${FLOOR} on the way, and stop</span></div>` +
    `<div><b>${kellyText(r.kelly)}</b><span>the size that grows the account fastest over many trades</span></div>`
  );
}

const width = (o) => `${(Math.min(1, Math.max(0, o.p)) * 100).toFixed(1)}%`;

/** The bars' rows at the current odds, the slider's size marked. */
export function barsHtml(r, size) {
  return (
    `<div class="sb hd"><span>Size</span><span>Share of runs</span><span></span></div>` +
    barSizes(size)
      .map((s) => {
        const o = outcomes(r, s);
        return (
          `<div class="sb${s === size ? " on" : ""}"><span>${s}%</span>` +
          `<span class="tr"><i class="cp" style="width:${width(o.ahead)}"></i><i class="bu" style="width:${width(o.floor)}"></i></span>` +
          `<span class="n">${share(o.ahead)} ahead · ${share(o.floor)} to ${FLOOR}</span></div>`
        );
      })
      .join("")
  );
}

/** What a win and then a loss of the same size leave of the $10,000: the leak the lesson explains. */
export const winThenLoss = (size) => dollars((START_CENTS * (100 + size) * (100 - size)) / 10000);

/**
 * The lesson's paragraph on the fastest-growing size, at the reader's odds: that size, the share that falls to $5,000
 * at half of it, at twice it and at it. With no positive edge, or one under 1%, the shares at 1% and 10% instead.
 */
export function lessonText(r) {
  const odds = `At a ${tenths(r.P)}% win chance and a ${tenths(r.B)}% payoff`;
  const fell = (s) => share(outcomes(r, s).floor);
  const k = r.kelly;
  if (k.kind === "none") {
    return `${odds}, the edge is ${edgeText(r.edgeTenths)}. No size grows the account on average; a bigger size only makes it shrink faster. At 1%, ${fell(1)} of runs fall to ${FLOOR}. At 10%, ${fell(10)} do.`;
  }
  if (k.kind === "under") {
    return `${odds}, the edge is so thin that the size that grows the account fastest is under 1%. Even at 1%, ${fell(1)} of runs fall to ${FLOOR}. At 10%, ${fell(10)} do.`;
  }
  const K = k.pct;
  const half = Math.max(1, Math.round(K / 2));
  const twice = Math.min(100, 2 * K);
  const smaller = half < K ? ` A smaller size grows more slowly but falls to ${FLOOR} less often: at ${half}%, ${fell(half)} of runs do.` : "";
  return `So one size grows the account fastest over many trades: the edge divided by the payoff. ${odds}, it is ${K}%.${smaller} A bigger size takes more risk and grows more slowly too: at ${twice}%, ${fell(twice)} of runs fall to ${FLOOR}. Even at ${K}% itself, ${fell(K)} of runs fall to ${FLOOR} at some point on the way.`;
}

export const sliderText = (size) => ({ value: String(size), valuetext: `${size}% of the account on each trade` });

/** The runs chart's tally: counted from the thirty drawn runs, and says so. The sentence above the chart is the exact odds. */
export function tallyText(t) {
  return `These 30 drawn runs: ${t.ahead} ended above ${START} · ${t.half} fell to ${FLOOR} and stopped · ${t.neither} ended between ${FLOOR} and ${START}.`;
}

/** The size the ochre tick marks: the fastest-growing size, when it is a whole percent the slider reaches. */
export const tickSize = (r) => (r.kelly.kind === "pct" && r.kelly.pct >= SIZE_MIN && r.kelly.pct <= SIZE_MAX ? r.kelly.pct : null);

/** Where the tick sits along the slider, centred on the thumb's travel (the thumb is 28px wide). */
export const tickLeft = (pct) => `calc(14px + (100% - 28px) * ${((pct - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)).toFixed(4)})`;

/**
 * The line under the slider: names the tick, or says why there is none. The size is r.kelly, the figure the tile prints,
 * so the note, the tick and the tile are one rounded number. Empty at no edge: the sentence above says so.
 */
export function tickNote(r) {
  const k = r.kelly;
  if (k.kind === "none") return "";
  const fastest = "the size that grows the account fastest over many trades";
  if (k.kind === "under") return `The ${fastest.slice(4)} is under 1%.`;
  return tickSize(r) === null ? `The ${fastest.slice(4)} is ${k.pct}%, past the end of this slider.` : `The tick marks ${k.pct}%, ${fastest}.`;
}

/** The chart for one size: the two drawings (the kit shows one by width), the tally, and the text alternative. */
export function chartParts(r, size, o = outcomes(r, size)) {
  const runs = drawRuns(r, size);
  const t = tally(runs);
  return {
    wide: chartSvg(runs, VIEWS.wide),
    narrow: chartSvg(runs, VIEWS.narrow),
    tally: tallyText(t),
    label: chartLabel(size, sayText(r, size, o), tallyText(t)),
  };
}
