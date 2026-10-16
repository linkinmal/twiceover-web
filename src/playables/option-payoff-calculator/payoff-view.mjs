/**
 * payoff-view — the words and drawings of "The option payoff calculator" (blog-handoff.md section 5.3, kit v3), as
 * functions of an `evaluate` result. The build prints the opening state with them and the block script calls the
 * same ones on every input, so the served page and the live page are one set of sentences. Every string is fixed
 * wording plus numbers the engine computed or the reader typed after validation; no text from the page, the URL
 * or storage goes in. Page text is Growth's (`ai-team/growth/blog-site-copy.md` section 8); game and tool pages
 * keep the full banned-word scan (ADR 1090 Decision 9), so an option is "bought" or "sold", never the bare verb.
 */
import { STRUCTURES, shapeCards } from "./payoff-builder.mjs";
import { rowHtml, showNumber } from "../_kit/number-input.mjs";
import { groupThousands as grp } from "../_kit/money.mjs";

/** Whole dollars, signed only when negative: $1,234 or −$57. */
export const pm = (x) => {
  const a = Math.abs(Math.round(x));
  return (x < 0 && a > 0 ? "−" : "") + "$" + grp(a);
};
/** Whole dollars with a plus when positive. */
export const ps = (x) => (Math.round(x) > 0 ? "+" : "") + pm(x);
/** A price: whole dollars bare, else cents. */
export const pp = (x) => "$" + grp(Number.isInteger(x) ? x : x.toFixed(2));
export const f2 = (x) => "$" + grp(x.toFixed(2));
const tone = (x) => (x > 0.5 ? "pos" : x < -0.5 ? "neg" : "");

/** What each structure is (one line) and what it does (the rest), as the picker shows them under the six pictures. */
export const DESCRIPTIONS = Object.freeze({
  lc: { s: "A call you bought.", d: "You pay the premium. It makes money when the stock ends above the strike by more than the premium. The most it can lose is the premium." },
  lp: { s: "A put you bought.", d: "You pay the premium. It makes money when the stock ends below the strike by more than the premium. The most it can lose is the premium." },
  cc: { s: "100 shares you own, with a call sold against them.", d: "You keep the premium. You give up any gain in the shares above the strike. If the shares fall, you lose on them, less the premium." },
  csp: { s: "A put you sold, with the cash set aside to pay for the shares at the strike.", d: "You keep the premium. If the stock ends below the strike, you pay the strike price for shares that are worth less." },
  vs: { s: "Two options of the same kind and expiration: one you bought at one strike, one you sold at another.", d: "The premium you collect offsets the premium you pay. Both the gain and the loss are capped." },
  st: { s: "A call and a put you bought, both at the same strike.", d: "It makes money when the stock ends far enough from the strike, in either direction, to cover both premiums." },
});
export const describe = (kind) => `${DESCRIPTIONS[kind].s} ${DESCRIPTIONS[kind].d}`;

export const FINDS = Object.freeze([
  ["The stock falls and the position makes money.", "Found. Puts and put spreads gain as the stock falls.", "Hint: pick the long put and drag the price down."],
  ["The position makes the most it can ever make.", "Found. The cap is built into the structure, and it is on the screen before you start.", "Hint: pick the covered call and drag the price up."],
  ["The position loses the most it can lose.", "Found. For a bought option the loss stops at a number you can read first.", "Hint: pick the long call and drag the price down."],
]);

export const structureOf = (kind, spreadType) => STRUCTURES.find((s) => s.kind === kind && s.spreadType === (kind === "vs" ? spreadType : null));
const unit = (f) => (f.id === "n" ? "" : "$");

/** Step 3's rows for a structure: its strikes and premiums, then the stock price now and the contracts. */
export function termsHtml(def, kind, stockNow = 100, contracts = 1, values = null) {
  const rows = def.fields.map((f) => rowHtml("po-" + f.id, f.label, showNumber(values ? values[f.id] : f.default), unit(f))).join("");
  const extra = kind === "cc" ? '<div class="trow"><span class="tl0">Shares you hold</span><output id="po-sh"></output></div>' : kind === "csp" ? '<div class="trow"><span class="tl0">Cash set aside</span><output id="po-cash"></output></div>' : "";
  return rows + rowHtml("po-S0", "Stock price now", stockNow, "$") + rowHtml("po-n", "Contracts", contracts, "") + extra;
}

export function typeRowHtml(spreadType) {
  return `<div class="trow"><span class="tl0" id="po-tyl">Both options are</span><div class="chips" role="group" aria-labelledby="po-tyl"><button type="button" class="chip" data-vt="c" aria-pressed="${spreadType === "c"}">Calls</button><button type="button" class="chip" data-vt="p" aria-pressed="${spreadType === "p"}">Puts</button></div></div>`;
}

/** What it does, from the figures. Uses only numbers the page computed or the reader typed. */
export function whyHtml({ kind, spreadType, values: v, stockNow, e }) {
  const m = e.multiplier;
  const tt = (x) => pm(x * m);
  const per = "$" + grp(m);
  const be = e.breakEvens;
  let why;
  if (kind === "lc") why = `You pay ${f2(v.P)} a share, ${tt(v.P)} in all. Below the ${pp(v.K)} strike the call expires worthless, so the most you can lose is that ${tt(v.P)}. Above the strike the call's value rises ${per} for every $1 the stock rises, so it breaks even at ${pp(v.K + v.P)}.`;
  else if (kind === "lp") why = `You pay ${f2(v.P)} a share, ${tt(v.P)} in all. Above the ${pp(v.K)} strike the put expires worthless, so the most you can lose is that ${tt(v.P)}. Below the strike it gains ${per} for every $1 the stock falls, ${be.length ? `so it breaks even at ${pp(be[0])}. The most it can make, ${tt(v.K - v.P)}, comes only if the stock goes to zero.` : "but the premium is more than the strike, so it makes money at no price."}`;
  else if (kind === "cc") why = `You hold ${grp(m)} shares you bought at ${pp(stockNow)}, and you sold a call at ${pp(v.K)} for ${f2(v.P)} a share. The premium cushions a fall by that much.${be.length ? ` It breaks even at ${pp(be[0])}.` : " It loses money at every price."}${e.maxGainTotal > 0 ? ` Above ${pp(v.K)} the call takes back every extra dollar the shares gain, so the best case is ${ps(e.maxGainTotal)}, however high the stock goes.` : ""}`;
  else if (kind === "csp") why = `You collect ${f2(v.P)} a share, ${tt(v.P)} in all, and set aside ${pm(v.K * m)} in cash. If the stock ends above ${pp(v.K)} the put expires and you keep the ${tt(v.P)}, the most it can make. Below ${pp(v.K)} you take the shares at ${pp(v.K)} and lose ${per} for every $1 the stock falls below it, less the premium you kept${be.length ? `, so it breaks even at ${pp(be[0])}` : ""}.`;
  else if (kind === "vs") {
    const net = v.Pb - v.Ps;
    const ty = spreadType === "c" ? "call" : "put";
    why = `The ${ty} you bought has a ${pp(v.Kb)} strike and the ${ty} you sold has a ${pp(v.Ks)} strike. Together they ${net >= 0 ? "cost" : "bring in"} a net ${f2(Math.abs(net))} a share, ${tt(Math.abs(net))} in all. Both ends are capped: ${e.maxGainTotal > 0 ? `the most it can make is ${pm(e.maxGainTotal)}` : "it cannot make money at any price"} and ${e.maxLossTotal < 0 ? `the most it can lose is ${pm(-e.maxLossTotal)}` : "it cannot lose at any price"}. Between the two strikes its value moves ${per} for every $1 the stock moves.`;
  } else {
    const c = v.Pc + v.Pp;
    why = `The call and the put you bought both have a ${pp(v.K)} strike. Together they cost ${f2(c)} a share, ${tt(c)} in all. It loses the most, that whole ${tt(c)}, if the stock ends exactly at the strike. ${v.K - c > 0 ? "It makes money only if the stock ends below " + pp(v.K - c) + " or above " + pp(v.K + c) + ", the two breakevens." : "It makes money only if the stock ends above " + pp(v.K + c) + ", its breakeven."}`;
  }
  return `<b>What it does.</b> ${why}`;
}

export function headHtml(e) {
  const t = e.handleTotal;
  return `Stock at ${pp(e.handle)}. Profit or loss <b class="${tone(t)}">${Math.abs(t) < 0.5 ? "flat" : ps(t)}</b>.`;
}
function unitsText({ kind, values, e }) {
  const n = e.multiplier / 100;
  if (kind === "cc") return `${n === 1 ? "1 covered call" : n + " covered calls"} (${grp(e.multiplier)} shares)`;
  if (kind === "csp") return `${n === 1 ? "1 contract" : n + " contracts"}, with ${pm(values.K * e.multiplier)} set aside`;
  return n === 1 ? "1 contract" : n + " contracts";
}
export function sentenceHtml(model) {
  const { e } = model;
  const t = e.handleTotal;
  return `With the stock at ${pp(e.handle)} on the last day, this position is ${Math.abs(t) < 0.5 ? "exactly flat" : (t > 0 ? "up " : "down ") + "<b>" + pm(Math.abs(t)) + "</b>"} on ${unitsText(model)}.`;
}

/** The three figures. The value at the picked price is the headline, so there is no fourth. */
export function statsHtml(e) {
  const z = " if the stock went to zero";
  const gain = e.gainUnlimited ? "No limit" : ps(e.maxGainTotal);
  const loss = e.lossUnlimited ? "No limit" : e.maxLossTotal < 0 ? pm(e.maxLossTotal) : "None";
  const lossHas = e.lossUnlimited || e.maxLossTotal < 0;
  const be = e.breakEvens;
  return (
    `<div><b class="${e.gainUnlimited || e.maxGainTotal > 0 ? "pos" : ""}">${gain}</b><span>most it can make${e.gainUnlimited ? "" : e.maxGainAtZero ? z : ""}</span></div>` +
    `<div><b class="${lossHas ? "neg" : ""}">${loss}</b><span>${lossHas ? "most it can lose" + (e.lossUnlimited ? "" : e.maxLossAtZero ? z : "") : "no loss at any price"}</span></div>` +
    `<div><b>${be.length ? be.map(f2).join("<br>") : "None"}</b><span>${be.length ? "breakeven" + (be.length > 1 ? "s" : "") + ", where it neither gains nor loses" : "it never crosses zero"}</span></div>`
  );
}

export function findsHtml(found) {
  return FINDS.map((t, i) => `<li class="${found[i] ? "on" : ""}"><i aria-hidden="true">${found[i] ? "✓" : i + 1}</i><div><b>${t[0]}</b><span>${found[i] ? t[1] : t[2]}</span></div></li>`).join("");
}

export function chartLabel(def, e) {
  const { lo, hi } = e.range;
  return `${def.name}: profit or loss on the last day for stock prices from ${pp(lo)} to ${pp(hi)}. Most it can make ${e.gainUnlimited ? "has no limit" : pm(e.maxGainTotal)}. Most it can lose ${e.lossUnlimited ? "has no limit" : e.maxLossTotal < 0 ? pm(-e.maxLossTotal) : "is nothing"}. Breakeven ${e.breakEvens.length ? e.breakEvens.map(f2).join(" and ") : "none"}.`;
}
export function chartCaption(def, e) {
  const n = new Set(e.position.legs.map((l) => l[2])).size;
  return `Profit or loss of the ${def.name.toLowerCase()} on its last day, for stock prices from ${pp(e.range.lo)} to ${pp(e.range.hi)}. Green is a gain and red is a loss. The dashed ${n > 1 ? "lines mark the strikes" : "line marks the strike"}.`;
}

/**
 * The chart: the plot, then the price axis (the slider's own track, laid over it by CSS), then the price labels.
 * `geom` lets the script map a pointer to a price; `axisTop` is where the slider sits.
 */
export function chartSvg(e, curve, W = 600) {
  const { lo, hi } = e.range;
  const m = e.multiplier;
  const M = { l: 18, r: 18, t: 46 };
  const yb = M.t + (W < 520 ? 190 : 220);
  const ya = yb + 18;
  const H = ya + 58;
  const ys = curve.map((p) => p[1]);
  const vmx = Math.max(...ys, 0);
  const vmn = Math.min(...ys, 0);
  const pad = (vmx - vmn || 1) * 0.14;
  const ymx = vmx + pad;
  const ymn = vmn - pad;
  const x = (p) => M.l + ((p - lo) / (hi - lo)) * (W - M.l - M.r);
  const y = (u) => M.t + ((ymx - u) / (ymx - ymn)) * (yb - M.t);
  const X = (p) => x(p).toFixed(1);
  const Y = (u) => y(u).toFixed(1);
  const y0 = Y(0);
  const line = curve.map((p, i) => (i ? "L" : "M") + X(p[0]) + " " + Y(p[1])).join("");
  const area = `M${X(lo)} ${y0} ` + curve.map((p) => "L" + X(p[0]) + " " + Y(p[1])).join(" ") + ` L${X(hi)} ${y0} Z`;
  const strikes = [...new Set(e.position.legs.map((l) => l[2]))].filter((k) => k > lo && k < hi);
  const anc = (px) => (px < W * 0.18 ? "start" : px > W * 0.82 ? "end" : "middle");
  let g = `<clipPath id="po-cu"><rect width="${W}" height="${y0}"/></clipPath><clipPath id="po-cd"><rect y="${y0}" width="${W}" height="${(yb - y(0) + 1).toFixed(1)}"/></clipPath><path d="${area}" fill="var(--gain)" opacity=".28" clip-path="url(#po-cu)"/><path d="${area}" fill="var(--loss)" opacity=".28" clip-path="url(#po-cd)"/><line class="gl" x1="${M.l}" x2="${W - M.r}" y1="${y0}" y2="${y0}"/><text class="ax" x="${M.l}" y="${(y(0) - 7).toFixed(1)}">no gain or loss</text>`;
  for (const k of strikes) g += `<line class="gl" x1="${X(k)}" x2="${X(k)}" y1="${M.t}" y2="${ya}" style="stroke-dasharray:3 4"/><text class="ax" x="${X(k)}" y="${ya + 34}" text-anchor="${anc(x(k))}">${strikes.length > 1 ? "" : "strike "}${pp(k)}</text>`;
  const S0 = e.stockNow;
  if (S0 > lo && S0 < hi) g += `<line x1="${X(S0)}" x2="${X(S0)}" y1="${ya - 6}" y2="${ya + 6}" stroke="var(--ink)" stroke-width="2"/><text class="ax" x="${X(S0)}" y="${ya + 52}" text-anchor="${anc(x(S0))}">now ${pp(S0)}</text>`;
  g += `<path class="l2" d="${line}"/>`;
  const top = curve.reduce((a, p) => (p[1] > a[1] ? p : a));
  const bot = curve.reduce((a, p) => (p[1] < a[1] ? p : a));
  const hx = x(e.handle);
  if (vmx > 0 && Math.abs(x(top[0]) - hx) > 56) g += `<text class="ax" x="${X(top[0])}" y="${(y(top[1]) - 9).toFixed(1)}" text-anchor="${anc(x(top[0]))}">${ps(top[1] * m)}</text>`;
  if (vmn < 0 && Math.abs(x(bot[0]) - hx) > 56) g += `<text class="ax" x="${X(bot[0])}" y="${(y(bot[1]) + 20).toFixed(1)}" text-anchor="${anc(x(bot[0]))}">${pm(bot[1] * m)}</text>`;
  for (const b of e.breakEvens.filter((b) => b > lo && b < hi)) g += `<circle cx="${X(b)}" cy="${y0}" r="5" fill="var(--plate)" stroke="var(--ink)" stroke-width="2"/>`;
  const prof = e.handleProfitPerShare;
  const hc = prof > 0.005 ? "var(--gain)" : prof < -0.005 ? "var(--loss)" : "var(--ink)";
  const t = e.handleTotal;
  g += `<line x1="${X(e.handle)}" x2="${X(e.handle)}" y1="${M.t - 10}" y2="${ya}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="2 4"/><circle cx="${X(e.handle)}" cy="${Y(prof)}" r="9" fill="${hc}" stroke="var(--plate)" stroke-width="3"/><text class="hlab" x="${X(e.handle)}" y="${M.t - 18}" text-anchor="${anc(hx)}">${pp(e.handle)} · ${Math.abs(t) < 0.5 ? "flat" : ps(t)}</text>`;
  return { svg: g, H, axisTop: ya - 22, geom: { lo, hi, W, ml: M.l, mr: M.r } };
}

/** A small picture of one position at its example numbers. `id` keeps the clip ids apart; `labelled` makes it an image. */
export function miniSvg(card, id, labelled) {
  const { lo, hi } = card.range;
  const ys = card.curve.map((p) => p[1]);
  const mx = Math.max(...ys, 0);
  const mn = Math.min(...ys, 0);
  const W = 200;
  const H = 84;
  const x = (p) => 6 + ((p - lo) / (hi - lo)) * (W - 12);
  const y = (u) => 6 + ((mx - u) / (mx - mn || 1)) * (H - 12);
  const d = card.curve.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join("");
  const area = `M${x(lo)} ${y(0)} ` + card.curve.map((p) => "L" + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join(" ") + ` L${x(hi)} ${y(0)} Z`;
  const u = `m${id}u-${card.kind}${card.spreadType ?? ""}`;
  const dn = `m${id}d-${card.kind}${card.spreadType ?? ""}`;
  const a11y = labelled ? `role="img" aria-label="${card.name}: profit or loss at expiration"` : 'aria-hidden="true"';
  return `<svg viewBox="0 0 ${W} ${H}" ${a11y}><clipPath id="${u}"><rect width="${W}" height="${y(0)}"/></clipPath><clipPath id="${dn}"><rect y="${y(0)}" width="${W}" height="${H}"/></clipPath><path d="${area}" fill="var(--gain)" opacity=".3" clip-path="url(#${u})"/><path d="${area}" fill="var(--loss)" opacity=".3" clip-path="url(#${dn})"/><line class="gl" x1="6" x2="${W - 6}" y1="${y(0)}" y2="${y(0)}"/><path class="l2" d="${d}"/></svg>`;
}

/** Step 1: the six pictures are the picker. The spread's picture follows the Calls/Puts choice. */
export function cardsHtml(kind, spreadType) {
  const byKind = new Map();
  for (const c of shapeCards(spreadType ?? "c")) byKind.set(c.kind, c);
  return [...byKind.values()].map((c) => `<button type="button" class="shape" data-k="${c.kind}" aria-pressed="${c.kind === kind}">${miniSvg(c, "p", false)}<b>${c.name}</b></button>`).join("");
}

/** After the steps: the six with their limits, as a plain list. Nothing in it is a control. */
export function sixHtml() {
  const z = " if the stock went to zero";
  return shapeCards("c")
    .map((c) => {
      const gain = c.maxGainTotal === null ? "no limit" : pm(c.maxGainTotal) + (c.maxGainAtZero ? z : "");
      const loss = c.maxLossTotal === null ? "no limit" : c.maxLossTotal < 0 ? pm(-c.maxLossTotal) + (c.maxLossAtZero ? z : "") : "none";
      const be = c.breakEvens.length ? `Breaks even at ${c.breakEvens.map(f2).join(" and ")}.` : "It never crosses zero.";
      return `<li>${miniSvg(c, "s", true)}<div><b>${c.name}${c.kind === "vs" ? ", with calls" : ""}</b><span>${DESCRIPTIONS[c.kind].s}</span><span>Most it can make: ${gain}. Most it can lose: ${loss}. ${be}</span></div></li>`;
    })
    .join("");
}
