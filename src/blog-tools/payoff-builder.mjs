/**
 * payoff-builder — the engine behind "The payoff builder" tool page (ADR 1090 Decision 8; the design's
 * `blog-handoff.md` §5.3; behavioural reference `blog-kit-2026-10-10-v2.html`, "the payoff builder").
 *
 * A position is `{ stockUnits, legs[] }`: `stockUnits` shares per 100 bought at "stock price now"
 * (1 for a covered call, else 0), and each leg is `[call or put, +1 bought or −1 sold, strike,
 * premium]`. Value **per share** at a stock price S on the last day:
 *
 *   stockUnits × (S − cost) + Σ q × (intrinsic(S) − premium),   rounded to 1e-9
 *
 * That is piecewise linear with kinks only at 0 and the strikes, so everything the page states — the
 * most it can make and lose, the break-evens, the drawn line — is read from the value at those points
 * and from the slope past the last strike. The corners ARE the payoff; nothing is sampled.
 *
 * Pure functions, no DOM and no clock; the build renders the opening state with them and the block
 * script recomputes on input. Nothing is fetched: every number is typed by the reader or computed here.
 * Wording is not here; the page chooses sentences from these figures.
 *
 * **Deliberate differences from the kit prototype**, for the Designer's gate: an unlimited gain or loss
 * is `Infinity` rather than the largest value at a kink; a price of $0 is never reported as a
 * break-even (a free call touches zero all the way down; its break-even is the strike).
 */
const CONTRACT = 100;
const EPS = 1e-9;
const round9 = (x) => Math.round(x * 1e9) / 1e9 + 0;
const roundCents = (x) => Math.round(x * 100) / 100 + 0;

/**
 * The structures, in the picker's order (the order ranks nothing). Field ids are the kit's: `K`/`P` a
 * strike and premium, `Kb`/`Ks`/`Pb`/`Ps` a spread's bought and sold strikes and premiums, `Pc`/`Pp` a
 * straddle's call and put premiums. The numbers are the design's invented, labelled examples at a
 * $100 stock; `handle` is the price the page opens with.
 */
export const STRUCTURES = Object.freeze(
  [
    { kind: "lc", name: "Long call", handle: 110, fields: [
      { id: "K", label: "Strike, $", default: 105, step: 0.5, type: "strike" },
      { id: "P", label: "Premium paid per share, $", default: 2.46, step: 0.05, type: "premium" }] },
    { kind: "lp", name: "Long put", handle: 90, fields: [
      { id: "K", label: "Strike, $", default: 95, step: 0.5, type: "strike" },
      { id: "P", label: "Premium paid per share, $", default: 2.1, step: 0.05, type: "premium" }] },
    { kind: "cc", name: "Covered call", handle: 110, fields: [
      { id: "K", label: "Strike of the call you sell, $", default: 105, step: 0.5, type: "strike" },
      { id: "P", label: "Premium received per share, $", default: 1.8, step: 0.05, type: "premium" }] },
    { kind: "csp", name: "Cash-secured put", handle: 92, fields: [
      { id: "K", label: "Strike of the put you sell, $", default: 95, step: 0.5, type: "strike" },
      { id: "P", label: "Premium received per share, $", default: 1.9, step: 0.05, type: "premium" }] },
    { kind: "vs", spreadType: "c", name: "Vertical spread", handle: 108, fields: [
      { id: "Kb", label: "Strike you buy, $", default: 100, step: 0.5, type: "strike" },
      { id: "Ks", label: "Strike you sell, $", default: 110, step: 0.5, type: "strike" },
      { id: "Pb", label: "Premium paid for the one you buy, $", default: 4.2, step: 0.05, type: "premium" },
      { id: "Ps", label: "Premium received for the one you sell, $", default: 1.7, step: 0.05, type: "premium" }] },
    { kind: "vs", spreadType: "p", name: "Vertical spread", handle: 92, fields: [
      { id: "Kb", label: "Strike you buy, $", default: 100, step: 0.5, type: "strike" },
      { id: "Ks", label: "Strike you sell, $", default: 90, step: 0.5, type: "strike" },
      { id: "Pb", label: "Premium paid for the one you buy, $", default: 3.8, step: 0.05, type: "premium" },
      { id: "Ps", label: "Premium received for the one you sell, $", default: 1.5, step: 0.05, type: "premium" }] },
    { kind: "st", name: "Straddle", handle: 112, fields: [
      { id: "K", label: "Strike, $", default: 100, step: 0.5, type: "strike" },
      { id: "Pc", label: "Call premium paid per share, $", default: 3.1, step: 0.05, type: "premium" },
      { id: "Pp", label: "Put premium paid per share, $", default: 2.9, step: 0.05, type: "premium" }] },
  ].map((s) => Object.freeze({ spreadType: null, ...s })),
);

const structureFor = (kind, spreadType) => STRUCTURES.find((s) => s.kind === kind && s.spreadType === (kind === "vs" ? spreadType : null));

/**
 * @typedef {[('c'|'p'), (1|-1), number, number]} Leg
 * @typedef {{stockUnits:number, legs:Leg[]}} Position
 */

/**
 * The legs for a structure.
 * @param {string} kind lc, lp, cc, csp, vs or st
 * @param {Record<string, number>} v the typed values, by field id
 * @param {'c'|'p'|null} [spreadType] for a vertical spread: a call spread or a put spread
 * @returns {Position}
 */
export function buildPosition(kind, v, spreadType) {
  switch (kind) {
    case "lc": return { stockUnits: 0, legs: [["c", 1, v.K, v.P]] };
    case "lp": return { stockUnits: 0, legs: [["p", 1, v.K, v.P]] };
    case "cc": return { stockUnits: 1, legs: [["c", -1, v.K, v.P]] };
    case "csp": return { stockUnits: 0, legs: [["p", -1, v.K, v.P]] };
    case "vs": return { stockUnits: 0, legs: [[spreadType, 1, v.Kb, v.Pb], [spreadType, -1, v.Ks, v.Ps]] };
    default: return { stockUnits: 0, legs: [["c", 1, v.K, v.Pc], ["p", 1, v.K, v.Pp]] };
  }
}

/**
 * Value per share at stock price `s` on the last day.
 * @param {Position} pos
 * @param {number} stockNow the price the shares were bought at (the cost of a covered call's shares)
 * @param {number} s
 */
export function payoffAt(pos, stockNow, s) {
  let r = pos.stockUnits * (s - stockNow);
  for (const [type, q, strike, premium] of pos.legs) {
    r += q * ((type === "c" ? Math.max(s - strike, 0) : Math.max(strike - s, 0)) - premium);
  }
  return round9(r);
}

/**
 * The most it can make and lose, the break-evens, and which extremes sit at a price of zero.
 * @param {Position} pos
 * @param {number} stockNow
 */
export function positionStats(pos, stockNow) {
  const kinks = [0, ...pos.legs.map((l) => l[2])].sort((a, b) => a - b).filter((x, i, a) => i === 0 || x !== a[i - 1]);
  const f = kinks.map((x) => payoffAt(pos, stockNow, x));
  // Slope of the line past the last strike: shares bought plus calls bought, minus calls sold.
  const slope = pos.stockUnits + pos.legs.reduce((a, l) => a + (l[0] === "c" ? l[1] : 0), 0);
  const gainUnlimited = slope > 0;
  const lossUnlimited = slope < 0;
  const maxFinite = Math.max(...f);
  const minFinite = Math.min(...f);
  // Is the line sloping down to a price of zero (so the extreme sits AT zero, not on a flat stretch)?
  const slopingAtZero = kinks.length > 1 ? f[0] !== f[1] : slope !== 0;
  const breakEvens = [];
  const add = (x) => {
    if (x > 0 && !breakEvens.some((b) => Math.abs(b - x) < EPS)) breakEvens.push(x);
  };
  for (let i = 0; i < kinks.length - 1; i++) {
    const a = f[i];
    const b = f[i + 1];
    if (a === 0) add(kinks[i]);
    else if (a * b < 0) add(kinks[i] - (a * (kinks[i + 1] - kinks[i])) / (b - a));
  }
  const last = f[f.length - 1];
  if (last === 0) add(kinks[kinks.length - 1]);
  else if (slope !== 0 && last * slope < 0) add(kinks[kinks.length - 1] - last / slope);
  return {
    kinks,
    values: f,
    slope,
    gainUnlimited,
    lossUnlimited,
    maxGain: gainUnlimited ? Infinity : maxFinite,
    maxLoss: lossUnlimited ? -Infinity : minFinite,
    maxGainAtZero: !gainUnlimited && kinks[f.indexOf(maxFinite)] === 0 && slope <= 0 && slopingAtZero,
    maxLossAtZero: !lossUnlimited && kinks[f.indexOf(minFinite)] === 0 && slope >= 0 && slopingAtZero,
    breakEvens: breakEvens.sort((a, b) => a - b),
  };
}

/**
 * The chart's price range: 0.55× the lowest of stock and strikes to 1.45× the highest, to whole
 * dollars; half-dollar handle steps under $100 wide.
 * @param {Position} pos
 * @param {number} stockNow
 */
export function chartRange(pos, stockNow) {
  const prices = [stockNow, ...pos.legs.map((l) => l[2])];
  const lo = Math.floor(Math.min(...prices) * 0.55);
  const hi = Math.ceil(Math.max(...prices) * 1.45);
  return { lo, hi, step: hi - lo >= 100 ? 1 : 0.5 };
}

/**
 * The drawn line: the value at the two edges and at every kink between them.
 * @param {Position} pos
 * @param {number} stockNow
 * @param {number} lo
 * @param {number} hi
 * @returns {[number, number][]}
 */
export function curvePoints(pos, stockNow, lo, hi) {
  const inside = positionStats(pos, stockNow).kinks.filter((x) => x > lo && x < hi);
  return [lo, ...inside, hi].map((x) => [x, payoffAt(pos, stockNow, x)]);
}

/**
 * Check the typed values.
 * @param {{kind:string, spreadType?:'c'|'p'|null, values:Record<string,number>, stockNow:number, contracts:number}} input
 * @returns {{ok:boolean, errors:Record<string,string>}} errors keyed by field id (`S0` stock price now, `n` contracts)
 */
export function validatePayoffInputs({ kind, spreadType, values, stockNow, contracts }) {
  const errors = {};
  const def = structureFor(kind, spreadType);
  for (const f of def.fields) {
    const x = values[f.id];
    if (f.type === "premium") {
      if (!Number.isFinite(x) || x < 0 || x > 100000) errors[f.id] = "Enter 0 or more.";
    } else if (!Number.isFinite(x) || x < 0.01 || x > 100000) {
      errors[f.id] = "Enter a price above 0.";
    }
  }
  if (!Number.isFinite(stockNow) || stockNow < 0.01 || stockNow > 100000) errors.S0 = "Enter a price above 0.";
  if (!Number.isInteger(contracts) || contracts < 1 || contracts > 100) errors.n = "Enter a whole number, 1 to 100.";
  if (kind === "vs" && Object.keys(errors).length === 0 && values.Kb === values.Ks) errors.Ks = "The two strikes must differ.";
  return { ok: Object.keys(errors).length === 0, errors };
}

const total = (perShare, multiplier) => roundCents(perShare * multiplier);

/**
 * Everything the page states about a typed position at a handle price.
 * @param {{kind:string, spreadType?:'c'|'p'|null, values:Record<string,number>, stockNow:number, contracts:number, handle:number}} input
 */
export function evaluate(input) {
  const { kind, spreadType = null, values, stockNow, contracts } = input;
  const check = validatePayoffInputs(input);
  if (!check.ok) return { ok: false, errors: check.errors };
  const position = buildPosition(kind, values, spreadType);
  const stats = positionStats(position, stockNow);
  const range = chartRange(position, stockNow);
  const handle = Number.isFinite(input.handle) ? Math.min(range.hi, Math.max(range.lo, input.handle)) : stockNow;
  const multiplier = CONTRACT * contracts;
  const handleProfitPerShare = payoffAt(position, stockNow, handle);
  return {
    ok: true,
    position,
    stats,
    range,
    handle,
    multiplier,
    handleProfitPerShare,
    handleTotal: total(handleProfitPerShare, multiplier),
    gainUnlimited: stats.gainUnlimited,
    lossUnlimited: stats.lossUnlimited,
    neverLoses: !stats.lossUnlimited && stats.maxLoss >= 0,
    maxGainTotal: stats.gainUnlimited ? null : total(stats.maxGain, multiplier),
    maxLossTotal: stats.lossUnlimited ? null : total(Math.min(stats.maxLoss, 0), multiplier),
    maxGainAtZero: stats.maxGainAtZero,
    maxLossAtZero: stats.maxLossAtZero,
    breakEvens: stats.breakEvens,
    cashSetAside: kind === "csp" ? values.K * multiplier : null,
    netPremium: kind === "vs" ? values.Pb - values.Ps : null,
    stockNow,
  };
}

/**
 * Which of the three things to find the handle's current place meets.
 * @param {ReturnType<typeof evaluate> & {ok:true}} e
 * @returns {[boolean, boolean, boolean]} the stock fell and the position made money; it is at the most it can make; at the most it can lose
 */
export function findsMet(e) {
  const p = e.handleProfitPerShare;
  const { maxGain, maxLoss } = e.stats;
  return [
    e.handle < e.stockNow && p > 0.005,
    !e.gainUnlimited && maxGain > 0 && p >= maxGain - EPS,
    !e.lossUnlimited && maxLoss < 0 && p <= maxLoss + EPS,
  ];
}

/** The six shapes side by side: each structure at its own example numbers, a $100 stock, one contract. */
export function shapeCards() {
  const order = [["lc", null], ["lp", null], ["cc", null], ["csp", null], ["vs", "c"], ["st", null]];
  return order.map(([kind, spreadType]) => {
    const def = structureFor(kind, spreadType);
    const values = Object.fromEntries(def.fields.map((f) => [f.id, f.default]));
    const e = evaluate({ kind, spreadType, values, stockNow: 100, contracts: 1, handle: def.handle });
    return {
      kind,
      spreadType,
      name: def.name,
      range: e.range,
      curve: curvePoints(e.position, 100, e.range.lo, e.range.hi),
      maxGainTotal: e.maxGainTotal,
      maxLossTotal: e.maxLossTotal,
      neverLoses: e.neverLoses,
      maxGainAtZero: e.maxGainAtZero,
      maxLossAtZero: e.maxLossAtZero,
    };
  });
}
