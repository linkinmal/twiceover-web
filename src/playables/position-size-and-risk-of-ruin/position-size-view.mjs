/**
 * position-size-view — the words of "Position size and risk of ruin" (definition.md beside this file). The build
 * imports these to print the opening example and the block script imports them to print the reader's, so a reader
 * with script off and a reader with script on see the same sentences. Every figure comes from position-size.mjs.
 */
import { barSizes, outcomes } from "./position-size.mjs";

const MINUS = "−";

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
export function edgeText(tenths) {
  const body = `${(Math.abs(tenths) / 10).toFixed(1)}%`;
  return tenths > 0 ? `+${body}` : tenths < 0 ? `${MINUS}${body}` : body;
}

export function kellyText(k) {
  return k.kind === "none" ? "none" : k.kind === "under" ? "under 1%" : `${k.pct}%`;
}

export const WIN_NOTE = "The chance that one trade wins.";
export const payoffNote = (r) => `Edge: ${edgeText(r.edgeTenths)} of the amount risked, on average.`;

export function sayText(r, size, o = outcomes(r, size)) {
  const first = `Risking ${size}% of the account on each trade, ${share(o.ahead)} of runs end 100 trades ahead and ${share(o.floor)} fall to half the start.`;
  return r.positive ? first : `${first} With no edge, no size grows the account on average.`;
}

export function answerHtml(r, size, o = outcomes(r, size)) {
  return (
    `<div><b>${share(o.ahead)}</b><span>of runs end 100 trades ahead</span></div>` +
    `<div><b>${share(o.floor)}</b><span>of runs fall to half the start</span></div>` +
    `<div><b>${kellyText(r.kelly)}</b><span>the size that grows the account fastest</span></div>`
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
          `<span class="n">${share(o.ahead)} ahead · ${share(o.floor)} at half</span></div>`
        );
      })
      .join("")
  );
}

export const sliderText = (size) => ({ value: String(size), valuetext: `${size}% of the account on each trade` });

