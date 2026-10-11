/**
 * call-view — the words and drawings of "The overnight call calculator" (blog-handoff.md section 5.2), as functions
 * of a `runOvernight` result. The build calls them to print the page's opening state and the block script calls
 * the same ones on every input, so the served page and the live page are one set of sentences. Every string is
 * built from numbers the engine computed and fixed wording; no text from the page, the URL or storage goes in.
 */
import { SLIDERS } from "./overnight-call.mjs";

export const money = (x) => "$" + Math.abs(x).toFixed(2);
export const sign = (x) => (x < 0 ? "−" : x > 0 ? "+" : "");
/** A percent with one decimal only when it has one: +4%, −6.5%. */
export const pct = (x) => sign(x) + (Math.abs(x) % 1 ? Math.abs(x).toFixed(1) : Math.abs(x).toFixed(0)) + "%";
/** The class a signed amount wears; colour never carries the sign alone (the sign is in the text). */
export const tone = (x) => (x < -0.004 ? "neg" : x > 0.004 ? "pos" : "");

export const FINDS = Object.freeze([
  ["The stock rises and the call still loses.", "Found. That is implied volatility leaving the price.", "Hint: try an earnings night."],
  ["Nothing moves and the call loses anyway.", "Found. That is time passing.", "Hint: set the stock flat and put implied volatility back where it started."],
  ["The stock falls and the call gains.", "Found. That takes implied volatility rising.", "Hint: push implied volatility well above where it started."],
]);

export function headlineHtml(r) {
  const { movePct } = r.inputs;
  const c = Math.abs(r.changePct) < 0.5 ? "flat" : sign(r.changePct) + Math.abs(r.changePct).toFixed(0) + "%";
  return `Stock <b class="${tone(movePct)}">${movePct ? pct(movePct) : "flat"}</b>. Call <b class="${tone(r.changePct)}">${c}</b>.`;
}

export function sentenceHtml(r) {
  const { v0, v3 } = r.values;
  const { daysPass } = r.inputs;
  const when = r.when === "next-morning" ? "the next morning" : r.when === "straight-after" ? "straight after" : `${daysPass} days later`;
  const pc = r.perContract;
  return `Worth <b>${money(v0)}</b> before and <b>${money(v3)}</b> ${when}. That is <b class="${tone(pc)}">${sign(pc)}$${Math.abs(pc).toFixed(0)}</b> on one contract of 100 shares.`;
}

export function breakEvenHtml(r) {
  const v0 = money(r.values.v0);
  return r.breakEven.kind === "none"
    ? `No stock move in range brings the call back to ${v0}.`
    : `Break-even: the stock needs <b>${pct(r.breakEven.pct)}</b> for the call to be worth ${v0} again.`;
}

export function whyHtml(r) {
  const { ivNowPct, ivAfterPct } = r.inputs;
  const { volatility, time } = r.parts;
  const text = {
    "stock-up-call-down-volatility": `The stock went the call's way. But the call's price already had a big move built in. When implied volatility fell from ${ivNowPct}% to ${ivAfterPct}%, that part of the price left. It was bigger than the gain from the stock.`,
    "stock-down-call-up": "The stock fell. Implied volatility rose enough to lift the call by more than the fall cost.",
    "time-only": `Nothing moved. The call still lost ${money(time)}, because it has less time left to work.`,
    "stock-led-gain": "The stock's move added more than volatility and time took away.",
    "stock-no-help": `The stock did not help the call${volatility < 0 ? ", and implied volatility fell too" : ""}.`,
    neutral: "The three middle bars add up to the change.",
  }[r.whyKey];
  return `<b>Why.</b> ${text}`;
}

export function pricedHtml(r) {
  const { ivNowPct, movePct } = r.inputs;
  return `<b>What was priced in.</b> At ${ivNowPct}% implied volatility, this call was priced for a stock move of about <b>±${r.pricedMovePct.toFixed(1)}%</b> in one day. You set ${movePct ? pct(movePct) : "no move"}.`;
}

export function summaryHtml(r) {
  const { strike, daysToExpiry, stock, ivNowPct } = r.inputs;
  return `<b>The call:</b> $${strike} strike, ${daysToExpiry} days out. Stock at $${stock}, IV ${ivNowPct}%.`;
}

/** What each slider shows beside it: its readout and the dollars it moves the call by. */
export function sliderText(r) {
  const { movePct, ivAfterPct, ivNowPct, daysPass } = r.inputs;
  const eff = (d) => `moves the call ${Math.abs(d) < 0.005 ? "$0.00" : sign(d) + money(d)}`;
  return {
    move: { value: movePct ? pct(movePct) : "flat", effect: eff(r.parts.stock), tone: tone(r.parts.stock) },
    iv: { value: `${Math.round(ivAfterPct)}%`, effect: `from ${Math.round(ivNowPct)}% · ${eff(r.parts.volatility)}`, tone: tone(r.parts.volatility) },
    days: { value: `${daysPass} ${daysPass === 1 ? "day" : "days"}`, effect: eff(r.parts.time), tone: tone(r.parts.time) },
  };
}

/** Where the break-even marker sits on the stock-move slider, or null when it is off the slider. */
export function breakEvenMarker(r) {
  if (r.breakEven.kind !== "move") return null;
  const { min, max } = SLIDERS.movePct;
  const p = r.breakEven.pct;
  if (p < min || p > max) return null;
  return { left: `calc(8px + (100% - 16px) * ${((p - min) / (max - min)).toFixed(4)})`, text: `break-even ${pct(Math.round(p * 10) / 10)}` };
}

export function findsHtml(found) {
  return FINDS.map(
    (t, i) => `<li class="${found[i] ? "on" : ""}"><i aria-hidden="true">${found[i] ? "✓" : i + 1}</i><div><b>${t[0]}</b><span>${found[i] ? t[1] : t[2]}</span></div></li>`,
  ).join("");
}

/** The grid of every case. `interactive` adds the button role and tab stop the script uses; served, cells are plain. */
export function heatHtml(grid, current, interactive) {
  const head = "<thead><tr><th></th>" + grid.moves.map((x) => `<th scope="col">stock ${x ? pct(x) : "flat"}</th>`).join("") + "</tr></thead>";
  const body = grid.rows
    .map((row) => {
      const cells = row.cells
        .map((c) => {
          const z = c.changePct;
          const k = z ? Math.round(Math.min(1, Math.abs(z) / 160) * 37 + 8) : 0;
          const now = row.iv === current.ivAfterPct && c.movePct === current.movePct;
          const attrs = interactive ? ` tabindex="0" role="button" data-m="${c.movePct}" data-iv="${row.iv}"` : "";
          return `<td class="hc${now ? " now" : ""}"${attrs} aria-label="Stock ${c.movePct}%, implied volatility ${row.iv}%: call ${z}%" style="background:color-mix(in srgb,var(--${z < 0 ? "loss" : "gain"}) ${k}%,var(--plate))">${z ? sign(z) + Math.abs(z) + "%" : "0%"}</td>`;
        })
        .join("");
      return `<tr><th scope="row">IV ${row.same ? "stays" : "to"} ${row.iv}%</th>${cells}</tr>`;
    })
    .join("");
  return head + `<tbody>${body}</tbody>`;
}

/** The waterfall: before, the three parts, after. `W` is the drawing's width in its own units. */
export function waterfallSvg(r, W = 600) {
  const { v0, v1, v2, v3 } = r.values;
  const steps = [
    ["Before", 0, v0, "tot"],
    ["Stock", v0, v1, ""],
    ["Volatility", v1, v2, ""],
    ["Time", v2, v3, ""],
    ["After", 0, v3, "tot"],
  ];
  const small = W < 520;
  const H = 270;
  const b = 46;
  const t = 34;
  const pad = small ? 2 : 12;
  const cw = (W - pad * 2) / steps.length;
  const mx = Math.max(...steps.map((z) => Math.max(z[1], z[2]))) * 1.15 || 1;
  const y = (v) => H - b - (v / mx) * (H - b - t);
  const bars = steps
    .map(([n, a, z, c], i) => {
      const x0 = pad + i * cw + cw * 0.15;
      const w = cw * 0.7;
      const top = y(Math.max(a, z));
      const hh = Math.max(3, Math.abs(y(a) - y(z)));
      const d = Math.round((z - a) * 100) / 100;
      const lab = c === "tot" ? "$" + z.toFixed(2) : (d >= 0 ? "+" : "−") + "$" + Math.abs(d).toFixed(2);
      const cls = c === "tot" ? (i ? "wn1" : "wn0") : d >= 0 ? "wg" : "wl";
      return `<rect class="${cls}" x="${x0.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"/><text class="wt" x="${(x0 + w / 2).toFixed(1)}" y="${(top - 9).toFixed(1)}">${lab}</text><text class="wn" x="${(x0 + w / 2).toFixed(1)}" y="${H - b + 24}">${n}</text>`;
    })
    .join("");
  return `<line class="gl" x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}"/>${bars}`;
}

/** The text a reader without the drawing gets: the five numbers the waterfall prints. */
export function waterfallLabel(r) {
  const { v0, v3 } = r.values;
  const { stock, volatility, time } = r.parts;
  const part = (n, d) => `${n} ${d < 0 ? "minus " : "plus "}${money(d)}`;
  return `The call's value: before ${money(v0)}; ${part("the stock", stock)}; ${part("volatility", volatility)}; ${part("time", time)}; after ${money(v3)}.`;
}
