/**
 * payoff-view — the words and drawings of "The payoff builder" (blog-handoff.md section 5.3), as functions of an
 * `evaluate` result. The build prints the opening state with them and the block script calls the same ones on every
 * input, so the served page and the live page are one set of sentences. Every string is fixed wording plus numbers the
 * engine computed or the reader typed after validation; no text from the page, the URL or storage goes in.
 *
 * Wording avoids the words the banned-term scan holds game and tool pages to (ADR 1090 Decision 9): a bought or
 * written option is "bought" or "sold", never the bare verb. Growth's copy pass owns the final text.
 */
import { STRUCTURES, shapeCards } from "./payoff-builder.mjs";

const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** Whole dollars, signed only when negative: $1,234 or −$57. */
export const pm = (x) => {
  const a = Math.abs(Math.round(x));
  return (x < 0 && a > 0 ? "−" : "") + "$" + grp(a);
};
/** Whole dollars with a plus when positive. */
export const ps = (x) => (Math.round(x) > 0 ? "+" : "") + pm(x);
/** A price: whole dollars bare, else cents. */
export const pp = (x) => "$" + (Number.isInteger(x) ? x : x.toFixed(2));
export const f2 = (x) => "$" + x.toFixed(2);
const tone = (x) => (x > 0.5 ? "pos" : x < -0.5 ? "neg" : "");

export const DESCRIPTIONS = Object.freeze({
  lc: "A bought call. You pay the premium. It gains when the stock ends above the strike. The most it can lose is the premium.",
  lp: "A bought put. You pay the premium. It gains when the stock ends below the strike. The most it can lose is the premium.",
  cc: "Own 100 shares and write a call against them. You collect the premium. The call takes every dollar the shares gain above its strike.",
  csp: "Write a put and set aside the cash to purchase the shares at the strike. You collect the premium. You are obliged to purchase if the stock ends below the strike.",
  vs: "Pair two options of the same kind and expiry: one you bought at one strike, one you wrote at another. The one you wrote pays for part of the one you bought, and caps the gain.",
  st: "A bought call and a bought put at the same strike. It gains when the stock ends far from the strike, in either direction.",
});

export const FINDS = Object.freeze([
  ["The stock falls and the position makes money.", "Found. Puts and put spreads gain as the stock falls.", "Hint: pick the long put and drag the price down."],
  ["The position makes the most it can ever make.", "Found. The cap is built into the structure, and it is on the screen before you start.", "Hint: pick the covered call and drag the price up."],
  ["The position loses the most it can lose.", "Found. For a bought option the loss stops at a number you can read first.", "Hint: pick the long call and drag the price down."],
]);

export const structureOf = (kind, spreadType) => STRUCTURES.find((s) => s.kind === kind && s.spreadType === (kind === "vs" ? spreadType : null));

/** One number field with its minus and plus buttons. */
export function fieldHtml(id, label, value, step) {
  return `<div class="fld"><label for="po-${id}">${label}</label><div class="nf"><button type="button" class="stp" data-for="po-${id}" data-d="-1" aria-label="${label}, down">−</button><input id="po-${id}" type="number" inputmode="decimal" step="${step}" value="${value}" aria-describedby="po-${id}-x"><button type="button" class="stp" data-for="po-${id}" data-d="1" aria-label="${label}, up">+</button></div><small id="po-${id}-x" hidden></small></div>`;
}
export const inputsHtml = (def) => def.fields.map((f) => fieldHtml(f.id, f.label, f.default, f.step)).join("");

export function kindsHtml(current) {
  const seen = new Set();
  return STRUCTURES.filter((s) => (seen.has(s.kind) ? false : seen.add(s.kind)))
    .map((s) => `<button type="button" class="chip" data-k="${s.kind}" aria-pressed="${s.kind === current}">${s.name}</button>`)
    .join("");
}
export function spreadTypeHtml(spreadType) {
  return `<div class="chips" role="group" aria-label="Call spread or put spread" style="margin:0"><button type="button" class="chip" data-vt="c" aria-pressed="${spreadType === "c"}">Call spread</button><button type="button" class="chip" data-vt="p" aria-pressed="${spreadType === "p"}">Put spread</button></div>`;
}

/** What the structure does, from the figures. Uses only numbers the page computed or the reader typed. */
export function whyHtml({ kind, spreadType, values: v, stockNow, e }) {
  const m = e.multiplier;
  const tt = (x) => pm(x * m);
  const st = e.stats;
  let why;
  if (kind === "lc") why = `You pay ${f2(v.P)} a share, ${tt(v.P)} in all. Below the ${f2(v.K)} strike the call expires worthless, so the most you can lose is that ${tt(v.P)}. Above the strike it gains $${m} for every $1 the stock rises, so it breaks even at ${f2(v.K + v.P)}.`;
  else if (kind === "lp") why = `You pay ${f2(v.P)} a share, ${tt(v.P)} in all. Above the ${f2(v.K)} strike the put expires worthless, so the most you can lose is that ${tt(v.P)}. Below the strike it gains $${m} for every $1 the stock falls, so it breaks even at ${f2(v.K - v.P)}. The most it can make, ${tt(v.K - v.P)}, is if the stock went to zero.`;
  else if (kind === "cc") why = `You hold ${m} shares bought at ${f2(stockNow)} and sold a call at ${f2(v.K)} for ${f2(v.P)} a share. The premium cushions a fall by that much, so it breaks even at ${f2(stockNow - v.P)}. Above ${f2(v.K)} the call takes back every extra dollar the shares gain, so the best case is ${ps(st.maxGain * m)}, however high the stock goes.`;
  else if (kind === "csp") why = `You collect ${f2(v.P)} a share, ${tt(v.P)} in all, and set aside ${pm(v.K * m)} in cash. If the stock ends above ${f2(v.K)} the put expires and you keep the ${tt(v.P)}, the most it can make. Below ${f2(v.K)} you purchase the shares at ${f2(v.K)} and lose dollar for dollar with the stock, less the premium, so it breaks even at ${f2(v.K - v.P)}.`;
  else if (kind === "vs") {
    const net = v.Pb - v.Ps;
    why = `Buying the ${f2(v.Kb)} and selling the ${f2(v.Ks)} ${spreadType === "c" ? "call" : "put"} ${net >= 0 ? "costs" : "collects"} a net ${f2(Math.abs(net))} a share, ${tt(Math.abs(net))} in all. Both ends are capped: the most it can make is ${pm(st.maxGain * m)} and the most it can lose is ${pm(-st.maxLoss * m)}. Between the two strikes it moves $${m} for every $1 the stock moves.`;
  } else {
    const c = v.Pc + v.Pp;
    why = `Buying a call and a put at ${f2(v.K)} costs ${f2(c)} a share, ${tt(c)} in all. It loses the most, that whole ${tt(c)}, if the stock ends exactly at the strike. It gains on a move either way: it breaks even ${v.K - c > 0 ? "below " + f2(v.K - c) + " or " : ""}above ${f2(v.K + c)}.`;
  }
  return `<b>What it does.</b> ${why}`;
}

export function headHtml(e) {
  const t = e.handleTotal;
  return `Stock at ${pp(e.handle)}. Position <b class="${tone(t)}">${Math.abs(t) < 0.5 ? "flat" : ps(t)}</b>.`;
}
function unitsText({ kind, values, e }) {
  const n = e.multiplier / 100;
  if (kind === "cc") return `${n === 1 ? "1 covered call" : n + " covered calls"} (${e.multiplier} shares)`;
  if (kind === "csp") return `${n === 1 ? "1 contract" : n + " contracts"}, with ${pm(values.K * e.multiplier)} set aside`;
  return n === 1 ? "1 contract" : n + " contracts";
}
export function sentenceHtml(model) {
  const { e } = model;
  const t = e.handleTotal;
  return `With the stock at ${pp(e.handle)} on the last day, this position is ${Math.abs(t) < 0.5 ? "exactly flat" : (t > 0 ? "up " : "down ") + "<b>" + pm(Math.abs(t)) + "</b>"} on ${unitsText(model)}.`;
}
export function breakEvenHtml(e) {
  return e.breakEvens.length ? `Break-even on the last day: <b>${e.breakEvens.map(f2).join("</b> and <b>")}</b>.` : "At no stock price does this position cross zero.";
}

export function statsHtml(e) {
  const z = " if the stock went to zero";
  const t = e.handleTotal;
  const gain = e.gainUnlimited ? "No limit" : ps(e.maxGainTotal);
  const loss = e.lossUnlimited ? "No limit" : e.maxLossTotal < 0 ? pm(e.maxLossTotal) : "None";
  const lossHas = e.lossUnlimited || e.maxLossTotal < 0;
  return (
    `<div><b class="${e.gainUnlimited || e.maxGainTotal > 0 ? "pos" : ""}">${gain}</b><span>most it can make${e.gainUnlimited ? "" : e.maxGainAtZero ? z : ""}</span></div>` +
    `<div><b class="${lossHas ? "neg" : ""}">${loss}</b><span>${lossHas ? "most it can lose" + (e.lossUnlimited ? "" : e.maxLossAtZero ? z : "") : "no loss at any price"}</span></div>` +
    `<div><b>${e.breakEvens.length ? e.breakEvens.map(f2).join(" · ") : "None"}</b><span>break-even${e.breakEvens.length > 1 ? "s" : ""} on the last day</span></div>` +
    `<div><b class="${tone(t)}">${Math.abs(t) < 0.5 ? "$0" : ps(t)}</b><span>at ${pp(e.handle)}</span></div>`
  );
}

export function handleText(e) {
  const t = e.handleTotal;
  return { value: pp(e.handle), effect: Math.abs(t) < 0.5 ? "flat" : (t > 0 ? "up " : "down ") + pm(Math.abs(t)), tone: tone(t) };
}
export const summaryHtml = (e) => `<b>The stock:</b> $${e.stockNow} now. ${e.multiplier / 100 === 1 ? "1 contract" : e.multiplier / 100 + " contracts"}.`;

export function findsHtml(found) {
  return FINDS.map((t, i) => `<li class="${found[i] ? "on" : ""}"><i aria-hidden="true">${found[i] ? "✓" : i + 1}</i><div><b>${t[0]}</b><span>${found[i] ? t[1] : t[2]}</span></div></li>`).join("");
}

export function chartLabel(def, e) {
  const { lo, hi } = e.range;
  return `${def.name}: profit or loss on the last day for stock prices from ${pp(lo)} to ${pp(hi)}. Most it can make ${e.gainUnlimited ? "has no limit" : pm(e.maxGainTotal)}. Most it can lose ${e.lossUnlimited ? "has no limit" : e.maxLossTotal < 0 ? pm(-e.maxLossTotal) : "is nothing"}. Break-even ${e.breakEvens.length ? e.breakEvens.map(f2).join(" and ") : "none"}.`;
}
export function chartCaption(def, e) {
  return `Profit or loss of the ${def.name.toLowerCase()} on its last day, for stock prices from ${pp(e.range.lo)} to ${pp(e.range.hi)}. Green is a gain, red is a loss, and the dashed lines are the strikes.`;
}

/** The chart, with its geometry so the script can map a pointer to a price. */
export function chartSvg(e, curve, W = 600) {
  const { lo, hi } = e.range;
  const m = e.multiplier;
  const H = 310;
  const M = { l: 12, r: 12, t: 46, b: 50 };
  const ys = curve.map((p) => p[1]);
  const vmx = Math.max(...ys, 0);
  const vmn = Math.min(...ys, 0);
  const pad = (vmx - vmn || 1) * 0.14;
  const ymx = vmx + pad;
  const ymn = vmn - pad;
  const x = (p) => M.l + ((p - lo) / (hi - lo)) * (W - M.l - M.r);
  const y = (u) => M.t + ((ymx - u) / (ymx - ymn)) * (H - M.t - M.b);
  const y0 = y(0);
  const pts = (p) => x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1);
  const d = curve.map((p, i) => (i ? "L" : "M") + pts(p)).join("");
  const area = `M${x(lo).toFixed(1)} ${y0.toFixed(1)} ` + curve.map((p) => "L" + pts(p)).join(" ") + ` L${x(hi).toFixed(1)} ${y0.toFixed(1)} Z`;
  const strikes = [...new Set(e.position.legs.map((l) => l[2]))].filter((k) => k > lo && k < hi);
  const anc = (px) => (px < W * 0.18 ? "start" : px > W * 0.82 ? "end" : "middle");
  let g = `<clipPath id="po-cu"><rect width="${W}" height="${y0.toFixed(1)}"/></clipPath><clipPath id="po-cd"><rect y="${y0.toFixed(1)}" width="${W}" height="${H}"/></clipPath><path d="${area}" fill="var(--gain)" opacity=".28" clip-path="url(#po-cu)"/><path d="${area}" fill="var(--loss)" opacity=".28" clip-path="url(#po-cd)"/><line class="gl" x1="${M.l}" x2="${W - M.r}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/><text class="ax" x="${M.l}" y="${(y0 - 7).toFixed(1)}">no gain or loss</text>`;
  for (const k of strikes) g += `<line class="gl" x1="${x(k).toFixed(1)}" x2="${x(k).toFixed(1)}" y1="${M.t}" y2="${H - M.b}" style="stroke-dasharray:3 4"/><text class="ax" x="${x(k).toFixed(1)}" y="${H - M.b + 18}" text-anchor="${anc(x(k))}">${pp(k)}</text>`;
  const S0 = e.stockNow;
  if (S0 > lo && S0 < hi) g += `<text class="ax" x="${x(S0).toFixed(1)}" y="${H - M.b + 36}" text-anchor="${anc(x(S0))}">now ${pp(S0)}</text><line x1="${x(S0).toFixed(1)}" x2="${x(S0).toFixed(1)}" y1="${H - M.b}" y2="${H - M.b + 6}" stroke="var(--ink2)"/>`;
  g += `<path class="l2" d="${d}"/>`;
  const top = curve.reduce((a, p) => (p[1] > a[1] ? p : a));
  const bot = curve.reduce((a, p) => (p[1] < a[1] ? p : a));
  const hx = x(e.handle);
  if (vmx > 0 && Math.abs(x(top[0]) - hx) > 56) g += `<text class="ax" x="${x(top[0]).toFixed(1)}" y="${(y(top[1]) - 9).toFixed(1)}" text-anchor="${anc(x(top[0]))}">${ps(top[1] * m)}</text>`;
  if (vmn < 0 && Math.abs(x(bot[0]) - hx) > 56) g += `<text class="ax" x="${x(bot[0]).toFixed(1)}" y="${(y(bot[1]) + 20).toFixed(1)}" text-anchor="${anc(x(bot[0]))}">${pm(bot[1] * m)}</text>`;
  for (const b of e.breakEvens.filter((b) => b > lo && b < hi)) g += `<circle cx="${x(b).toFixed(1)}" cy="${y0.toFixed(1)}" r="5" fill="var(--plate)" stroke="var(--ink)" stroke-width="2"/>`;
  const prof = e.handleProfitPerShare;
  const hy = y(prof);
  const hc = prof > 0.005 ? "var(--gain)" : prof < -0.005 ? "var(--loss)" : "var(--ink)";
  const t = e.handleTotal;
  g += `<line x1="${hx.toFixed(1)}" x2="${hx.toFixed(1)}" y1="${M.t - 10}" y2="${H - M.b}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="2 4"/><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="9" fill="${hc}" stroke="var(--plate)" stroke-width="3"/><text class="hlab" x="${hx.toFixed(1)}" y="${M.t - 18}" text-anchor="${anc(hx)}">${pp(e.handle)} · ${Math.abs(t) < 0.5 ? "flat" : ps(t)}</text>`;
  return { svg: g, geom: { lo, hi, W, ml: M.l, mr: M.r }, H };
}

function miniSvg(card) {
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
  const id = card.kind + (card.spreadType ?? "");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${card.name}: profit or loss at expiry"><clipPath id="mu-${id}"><rect width="${W}" height="${y(0)}"/></clipPath><clipPath id="md-${id}"><rect y="${y(0)}" width="${W}" height="${H}"/></clipPath><path d="${area}" fill="var(--gain)" opacity=".3" clip-path="url(#mu-${id})"/><path d="${area}" fill="var(--loss)" opacity=".3" clip-path="url(#md-${id})"/><line class="gl" x1="6" x2="${W - 6}" y1="${y(0)}" y2="${y(0)}"/><path class="l2" d="${d}"/></svg>`;
}

/** The six shapes. `interactive` makes each a button that loads it; served, each is a plain card. */
export function shapesHtml(current, interactive) {
  const z = " if the stock went to zero";
  return shapeCards()
    .map((c) => {
      const sub = `${c.maxGainTotal === null ? "Gain: no limit" : "Most it can make " + pm(c.maxGainTotal) + (c.maxGainAtZero ? z : "")}. ${c.maxLossTotal === null ? "Loss: no limit" : c.maxLossTotal < 0 ? "Most it can lose " + pm(-c.maxLossTotal) + (c.maxLossAtZero ? z : "") : "No loss"}.`;
      const pressed = c.kind === current.kind && (c.kind !== "vs" || c.spreadType === current.spreadType);
      const title = `${c.name}${c.kind === "vs" ? ", " + (c.spreadType === "c" ? "call" : "put") : ""}`;
      const inner = `${miniSvg(c)}<b>${title}</b><span>${sub}</span>`;
      return interactive
        ? `<li><button type="button" class="shape" data-k="${c.kind}" data-vt="${c.spreadType ?? ""}" aria-pressed="${pressed}">${inner}</button></li>`
        : `<li><div class="shape">${inner}</div></li>`;
    })
    .join("");
}
