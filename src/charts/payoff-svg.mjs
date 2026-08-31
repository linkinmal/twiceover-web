/**
 * The payoff chart's drawing half — the model from `payoff-chart.mjs` rendered as SVG body markup
 * (stock-analyst-platform#2994; build reference `site-charts-hero-2026-08-30.html` §7). Same builder
 * shape and the same reasons as `outlook-svg.mjs` beside it.
 *
 * **The two regions differ by TEXTURE and by WORDS, not by hue.** The loss side is a diagonal hatch,
 * the profit side a flat tint, and each is labelled in words inside the plot. That ordering is the
 * signed artifact's own dataviz note — texture before hue, because the dark green/red pair fails
 * deutan separation — and here it carries the whole distinction: colour never carries meaning alone
 * (WCAG 1.4.1), and on this site it carries none at all. See `PayoffChart.astro` for why the site's
 * copy of this chart is monochrome where the app's is signal-coloured.
 *
 * No figure on this chart is transcribed: every one comes from the model, which gets them from the
 * fixture's own sampler.
 */

import { clearOfPlaced } from "./payoff-chart.mjs";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);
const n = (v) => Number(v.toFixed(2));

/** `+$1,760` / `−$1,240` / `$0` — whole dollars, always signed, U+2212 for the minus. */
export function usd0(v) {
  const abs = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v === 0) return "$0";
  return `${v < 0 ? "−$" : "+$"}${abs}`;
}
const money = (v) => `$${v.toFixed(2)}`;

/** Minimum clearance between two centred labels above the plot, in user units — the app's own
 *  constant. Below this, two centred words overlap into one smear. */
const TOP_LABEL_MIN_GAP = 58;
/** The same, for the price figures on the axis below. */
const TICK_MIN_GAP = 46;
/** Rough advance width of one character in the mono face the extreme labels use, in user units per
 *  px of font size. Only ever used to ask "would this label overhang the frame?" — a question that
 *  needs an estimate, not a measurement, because the answer only ever flips the label to its other
 *  side and both sides are legible. */
const MONO_ADVANCE = 0.62;

/**
 * Which side of its mark an extreme label sits on.
 *
 * Each label has a PREFERRED side — the one the rising segment is not on, so the text never lies over
 * the data. It flips only when that side would overhang the frame, which is what happens at the
 * compact breakpoint: at 300 units wide, "Max profit +$1,760" placed right of a strike at x=193 runs
 * past the viewBox and clips. Deriving the flip from the overhang rather than from `compact` keeps it
 * correct if either the geometry or the fixture changes; the app hardcodes `compact ? 'end' : 'start'`
 * for the profit label and gets the same answer at today's two widths.
 */
function labelSide(x, text, fontSize, prefer, loBound, hiBound) {
  const w = text.length * fontSize * MONO_ADVANCE;
  if (prefer === "end") return x - 8 - w >= loBound ? "end" : "start";
  return x + 8 + w <= hiBound ? "start" : "end";
}

/** Round value-axis gridlines: the largest 1/2/5 x 10^k step giving at least three lines. */
export function gridValues(lo, hi) {
  const span = hi - lo;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= 6) ?? mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v));
  return out.includes(0) ? out : [...out, 0].sort((a, b) => a - b);
}

/**
 * @param {ReturnType<import("./payoff-chart.mjs").payoffChartModel>} m
 * @param {{ compact: boolean, lastClose: number, strikes: readonly number[], breakeven: number,
 *           contracts: number, id: string }} opts
 */
export function payoffSvgBody(m, { compact, lastClose, strikes, breakeven, contracts, id }) {
  const p = [];
  const plotTop = m.padTop;
  const plotBottom = m.height - m.padBottom;
  const right = m.width - m.padRight;
  const hatchId = `pf-hatch-${id}`;

  // The loss wash is a hatch, the profit wash a flat tint — they differ in texture before anything
  // else. A pattern id must be unique per instance, so it is generated rather than styled.
  p.push(
    `<defs><pattern id="${hatchId}" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">` +
      `<line class="pf-hatch" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>`,
  );
  const beX = m.x(breakeven);
  p.push(
    `<rect x="${n(m.x(m.domainLo))}" y="${plotTop}" width="${n(beX - m.x(m.domainLo))}" height="${plotBottom - plotTop}" fill="url(#${hatchId})" opacity="0.5"/>`,
    `<rect class="pf-zone-profit" x="${n(beX)}" y="${plotTop}" width="${n(right - beX)}" height="${plotBottom - plotTop}"/>`,
  );

  // Value axis. The $0 line is a FACT, not a scale mark, so it is solid and unfaded where the
  // others are hairlines.
  for (const g of gridValues(m.valueLo, m.valueHi)) {
    if (g !== 0) {
      p.push(`<line class="pf-grid" x1="${m.padLeft}" y1="${n(m.y(g))}" x2="${right}" y2="${n(m.y(g))}"/>`);
    }
    p.push(
      `<text class="pf-axis" text-anchor="end" x="${m.padLeft - 6}" y="${n(m.y(g) + 3)}">${esc(usd0(g))}</text>`,
    );
  }
  p.push(`<line class="pf-zero" x1="${m.padLeft}" y1="${n(m.zeroY)}" x2="${right}" y2="${n(m.zeroY)}"/>`);
  p.push(
    `<text class="pf-cap" x="${m.padLeft}" y="${plotTop - 11}">profit / loss at expiry — whole position, ${contracts} spreads</text>`,
  );

  // The payoff itself — straight lines between corner points, which IS the payoff, not a sampling
  // of it: slope changes only at a strike.
  p.push(
    `<path class="pf-line" d="${m.corners.map((c, i) => `${i === 0 ? "M" : "L"} ${n(m.x(c.price))} ${n(m.y(c.value))}`).join(" ")}"/>`,
  );

  p.push(
    `<line class="pf-berule" x1="${n(beX)}" y1="${plotTop}" x2="${n(beX)}" y2="${plotBottom}"/>`,
    `<circle class="pf-bedot" cx="${n(beX)}" cy="${n(m.zeroY)}" r="3.5"/>`,
    `<text class="pf-cap" text-anchor="middle" x="${n(beX)}" y="${plotTop - 3}">breakeven</text>`,
  );

  // The last close's RULE always draws; its word yields to the breakeven's when the two crowd. At
  // $184.52 against a $181.20 breakeven they are ~3.3 points apart, which at this domain is well
  // inside one label's width — and "breakevlast close" is not a smaller problem than a missing word.
  const lcX = m.x(lastClose);
  p.push(`<line class="pf-spot" x1="${n(lcX)}" y1="${plotTop}" x2="${n(lcX)}" y2="${plotBottom}"/>`);
  if (clearOfPlaced([beX], lcX, TOP_LABEL_MIN_GAP)) {
    p.push(`<text class="pf-spotlab" text-anchor="middle" x="${n(lcX)}" y="${plotTop - 3}">last close</text>`);
  }

  // The two bounds, each on its own kink. Both sides of this structure are bounded, so both carry a
  // marked endpoint — an unbounded side would get neither mark nor label.
  const loK = Math.min(...strikes);
  const hiK = Math.max(...strikes);
  const loV = m.corners.find((c) => c.price === loK).value;
  const hiV = m.corners.find((c) => c.price === hiK).value;
  const figSize = compact ? 8.5 : 9.5;
  const place = (x, text, prefer) => {
    const side = labelSide(x, text, figSize, prefer, m.padLeft, right);
    return `text-anchor="${side}" x="${n(side === "end" ? x - 8 : x + 8)}"`;
  };
  const lossText = `Max loss ${usd0(loV)}`;
  const profText = `Max profit ${usd0(hiV)}`;
  p.push(
    `<circle class="pf-maxloss-d" cx="${n(m.x(loK))}" cy="${n(m.y(loV))}" r="3.5"/>`,
    // Prefers the LEFT of the lower strike — the payoff rises to its right, and a label there would
    // sit over the line.
    `<text class="pf-halo pf-figure" ${place(m.x(loK), lossText, "end")} y="${n(m.y(loV) - 11)}">${esc(lossText)}</text>`,
    `<circle class="pf-maxprof-d" cx="${n(m.x(hiK))}" cy="${n(m.y(hiV))}" r="4"/>`,
    // Prefers the RIGHT of the upper strike, for the mirror-image reason.
    `<text class="pf-halo pf-figure" ${place(m.x(hiK), profText, "start")} y="${n(m.y(hiV) - 9)}">${esc(profText)}</text>`,
  );

  // The words are what carry the loss/profit distinction, alongside the texture.
  p.push(
    `<text class="pf-word" text-anchor="middle" x="${n((m.x(m.domainLo) + beX) / 2)}" y="${plotBottom - 10}">loss at expiry</text>`,
    `<text class="pf-word" text-anchor="middle" x="${n((beX + right) / 2)}" y="${plotBottom - 10}">profit at expiry</text>`,
    `<text class="pf-cap" text-anchor="middle" x="${n((m.padLeft + right) / 2)}" y="${m.height - 3}">share price at expiry</text>`,
  );

  // Price ticks. The last close deliberately carries NO numeric tick: at 184.52 it sits ~3.3 points
  // from the 181.20 breakeven, and two mono figures that close render as one smear. Its dashed rule
  // already marks the position, and the figure itself is stated in the rows beside the chart.
  // Priority order, not price order — `clearOfPlaced` withholds whatever comes later.
  const ticks = [
    { price: loK, text: money(loK), kind: "strike" },
    { price: hiK, text: money(hiK), kind: "strike" },
    { price: breakeven, text: money(breakeven), kind: "breakeven" },
  ];
  const placedTicks = [];
  for (const t of ticks) {
    const tx = n(m.x(t.price));
    // Strikes outrank the breakeven: a strike is where the structure's own math changes, and the
    // breakeven already carries a dashed rule and a dot on the $0 line.
    if (!clearOfPlaced(placedTicks, tx, TICK_MIN_GAP)) continue;
    placedTicks.push(tx);
    p.push(
      `<line class="pf-tick pf-tick--${t.kind}" x1="${tx}" y1="${plotBottom}" x2="${tx}" y2="${plotBottom + 4}"/>`,
      `<text class="pf-tickfig pf-tickfig--${t.kind}" text-anchor="middle" x="${tx}" y="${plotBottom + 14}">${esc(t.text)}</text>`,
    );
  }

  return p.join("");
}
