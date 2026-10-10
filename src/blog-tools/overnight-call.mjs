/**
 * overnight-call — the math behind "The overnight call calculator" (ADR 1090 Decision 8; the design's
 * `blog-handoff.md` §5.2; behavioural reference `blog-kit-2026-10-10-v2.html`, the "Tool page").
 *
 * A Black-Scholes European call with no interest rate and no dividend, time in calendar days over 365.
 * One night is split in a fixed order — the stock moves, then implied volatility changes, then days
 * pass — and **every price is rounded to cents before any difference is taken**, so the three bars of
 * the waterfall always add to the change with no stray cent.
 *
 * Pure functions, no DOM and no clock: the build imports this to render a page's opening state and the
 * block script in `public/js/` imports it to recompute on input, so both print the same numbers.
 * Every figure here is computed from what the reader typed; nothing is fetched. Wording is not here —
 * `whyKey` names the rule and the page chooses the sentence.
 *
 * **Deliberate differences from the kit prototype**, each stated for the Designer's gate: a
 * double-precision normal CDF (the kit's error is a visible cent at a $100,000 stock); a zero or
 * unreachable break-even says "none" where the kit would print −80%; the heat grid never includes a
 * 0% volatility row (the kit divides by zero for an implied volatility of 1%); a preset stays pressed
 * after the slider clamped it.
 */
import { normalCdf } from "./normal-cdf.mjs";

/** The design's opening case (§5.2 defaults). */
export const DEFAULTS = Object.freeze({
  stock: 100,
  strike: 105,
  daysToExpiry: 7,
  ivNowPct: 80,
  movePct: 4,
  ivAfterPct: 45,
  daysPass: 1,
});

/** Slider ranges from the design: stock move −15 to 15, volatility after 5 to 150, days 0 to 7. */
export const SLIDERS = Object.freeze({
  movePct: { min: -15, max: 15, step: 0.5 },
  ivAfterPct: { min: 5, max: 150, step: 1 },
  daysPass: { min: 0, max: 7, step: 1 },
});

const FIELD_RULES = [
  { key: "stock", min: 0.01, max: 100000, message: "Enter a price above 0." },
  { key: "strike", min: 0.01, max: 100000, message: "Enter a strike above 0." },
  { key: "daysToExpiry", min: 1, max: 730, message: "Enter 1 to 730 days." },
  { key: "ivNowPct", min: 1, max: 500, message: "Enter 1 to 500." },
];

/** The design's four presets; each sets the stock move, volatility after (now × factor) and one day. */
export const PRESETS = Object.freeze([
  { id: "beat", label: "Earnings beat, IV drops", movePct: 4, ivFactor: 0.5625 },
  { id: "miss", label: "Earnings miss, IV drops", movePct: -6, ivFactor: 0.5625 },
  { id: "gap", label: "Big gap up, IV drops", movePct: 10, ivFactor: 0.5625 },
  { id: "quiet", label: "Quiet night, nothing moves", movePct: 0, ivFactor: 1 },
]);

const HEAT_MOVES = [-8, -4, 0, 4, 8, 12];
const HEAT_IV_FACTORS = [1, 0.8, 0.5625, 0.4];
const BREAK_EVEN_LOW = 0.2;
const BREAK_EVEN_HIGH = 3;
const BREAK_EVEN_STEPS = 60;

/** Round to cents; half rounds up, and never returns −0. */
export function roundCents(x) {
  return Math.round(x * 100) / 100 + 0;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** A slider value held in range; one that is not a number falls back to the opening case, never NaN. */
const slider = (x, key) => (Number.isFinite(x) ? clamp(x, SLIDERS[key].min, SLIDERS[key].max) : DEFAULTS[key]);
const noNegZero = (x) => x + 0;

/**
 * Black-Scholes European call, rate 0, no dividend.
 * @param {number} stock
 * @param {number} strike
 * @param {number} iv implied volatility as a fraction (0.8 = 80%)
 * @param {number} days calendar days to expiry, over 365
 * @returns {number} the price; the intrinsic value when no time or no volatility is left
 */
export function callPrice(stock, strike, iv, days) {
  if (days <= 0 || iv <= 0) return Math.max(stock - strike, 0);
  const v = iv * Math.sqrt(days / 365);
  const d1 = (Math.log(stock / strike) + (v * v) / 2) / v;
  return stock * normalCdf(d1) - strike * normalCdf(d1 - v);
}

/**
 * @typedef {{stock:number, strike:number, daysToExpiry:number, ivNowPct:number, movePct:number, ivAfterPct:number, daysPass:number}} OvernightInputs
 */

/**
 * Check the four typed fields against the design's ranges.
 * @param {Partial<OvernightInputs>} raw
 * @returns {{ok: boolean, errors: Record<string,string>}}
 */
export function validateInputs(raw) {
  const errors = {};
  for (const { key, min, max, message } of FIELD_RULES) {
    const x = raw[key];
    if (!Number.isFinite(x) || x < min || x > max) errors[key] = message;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

function normalize(raw) {
  const daysPass = clamp(Math.floor(slider(raw.daysPass, "daysPass")), 0, Math.floor(raw.daysToExpiry));
  return {
    stock: raw.stock,
    strike: raw.strike,
    daysToExpiry: raw.daysToExpiry,
    ivNowPct: raw.ivNowPct,
    movePct: slider(raw.movePct, "movePct"),
    ivAfterPct: slider(raw.ivAfterPct, "ivAfterPct"),
    daysPass,
  };
}

/** The stock price where the call, after the volatility and days set, is worth `target` again. */
function breakEvenMove(inputs, target) {
  const { stock, strike, daysToExpiry, ivAfterPct, daysPass } = inputs;
  const left = daysToExpiry - daysPass;
  const iv = ivAfterPct / 100;
  const f = (s) => callPrice(s, strike, iv, left);
  if (target <= 0 || f(stock * BREAK_EVEN_HIGH) < target) return { kind: "none" };
  let lo = stock * BREAK_EVEN_LOW;
  let hi = stock * BREAK_EVEN_HIGH;
  for (let i = 0; i < BREAK_EVEN_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return { kind: "move", pct: Math.round((lo / stock - 1) * 1000) / 10 };
}

/** Which sentence the page shows under the answer: the first rule that matches. */
function whyKeyFor(inputs, parts, total) {
  const { movePct } = inputs;
  const volatilityFlat = Math.abs(parts.volatility) < 0.005;
  if (movePct > 0 && total < 0 && parts.volatility < 0) return "stock-up-call-down-volatility";
  if (movePct < 0 && total > 0) return "stock-down-call-up";
  if (movePct === 0 && volatilityFlat && parts.time < 0) return "time-only";
  if (total > 0 && parts.stock > 0) return "stock-led-gain";
  if (total < 0 && parts.stock <= 0) return "stock-no-help";
  return "neutral";
}

/**
 * Run one night.
 * @param {OvernightInputs} raw
 * @returns {{ok:false, errors:Record<string,string>} | {
 *   ok:true, inputs:OvernightInputs,
 *   values:{v0:number,v1:number,v2:number,v3:number},
 *   parts:{stock:number,volatility:number,time:number}, total:number, changePct:number, perContract:number,
 *   breakEven:{kind:'move',pct:number}|{kind:'none'}, pricedMovePct:number,
 *   when:'straight-after'|'next-morning'|'days-later', whyKey:string }}
 */
export function runOvernight(raw) {
  const check = validateInputs(raw);
  if (!check.ok) return { ok: false, errors: check.errors };
  const inputs = normalize(raw);
  const { stock, strike, daysToExpiry, ivNowPct, movePct, ivAfterPct, daysPass } = inputs;
  const moved = stock * (1 + movePct / 100);
  const ivNow = ivNowPct / 100;
  const ivAfter = ivAfterPct / 100;
  const v0 = roundCents(callPrice(stock, strike, ivNow, daysToExpiry));
  const v1 = roundCents(callPrice(moved, strike, ivNow, daysToExpiry));
  const v2 = roundCents(callPrice(moved, strike, ivAfter, daysToExpiry));
  const v3 = roundCents(callPrice(moved, strike, ivAfter, daysToExpiry - daysPass));
  const parts = {
    stock: roundCents(v1 - v0),
    volatility: roundCents(v2 - v1),
    time: roundCents(v3 - v2),
  };
  const total = roundCents(v3 - v0);
  return {
    ok: true,
    inputs,
    values: { v0, v1, v2, v3 },
    parts,
    total,
    changePct: v0 > 0 ? noNegZero((v3 / v0 - 1) * 100) : 0,
    perContract: roundCents(total * 100),
    breakEven: breakEvenMove(inputs, v0),
    pricedMovePct: ivNowPct / Math.sqrt(365),
    when: daysPass === 0 ? "straight-after" : daysPass === 1 ? "next-morning" : "days-later",
    whyKey: whyKeyFor(inputs, parts, total),
  };
}

/**
 * Which of the three things to find the reader's current setting meets.
 * @param {OvernightInputs} inputs normalized inputs
 * @param {{total:number}} result
 * @returns {[boolean, boolean, boolean]} stock up and call down; nothing moves and the call loses; stock down and call up
 */
export function findsMet(inputs, result) {
  const { movePct, ivAfterPct, ivNowPct, daysPass } = inputs;
  const { total } = result;
  return [
    movePct > 0 && total < 0,
    movePct === 0 && ivAfterPct === Math.round(ivNowPct) && daysPass >= 1 && total < 0,
    movePct < 0 && total > 0,
  ];
}

/**
 * The grid of every case: the call's percent change after the days set, for six stock moves against
 * four volatility levels (now × 1, .8, .5625, .4, rounded, never below 1, duplicates dropped).
 * @param {OvernightInputs} inputs normalized inputs
 * @param {{values:{v0:number}}} result
 */
export function heatGrid(inputs, result) {
  const { stock, strike, daysToExpiry, ivNowPct, daysPass } = inputs;
  const { v0 } = result.values;
  const ivs = [...new Set(HEAT_IV_FACTORS.map((k) => Math.max(1, Math.round(ivNowPct * k))))];
  return {
    moves: HEAT_MOVES,
    rows: ivs.map((iv) => ({
      iv,
      same: iv === Math.round(ivNowPct),
      cells: HEAT_MOVES.map((movePct) => {
        const v = callPrice(stock * (1 + movePct / 100), strike, iv / 100, daysToExpiry - daysPass);
        return { movePct, changePct: v0 > 0 ? noNegZero(Math.round((v / v0 - 1) * 100)) : 0 };
      }),
    })),
  };
}

/**
 * The slider values a preset sets, held inside the slider ranges.
 * @param {(typeof PRESETS)[number]} preset
 * @param {number} ivNowPct
 */
export function applyPreset(preset, ivNowPct) {
  const { ivAfterPct } = SLIDERS;
  return {
    movePct: preset.movePct,
    ivAfterPct: clamp(Math.round(ivNowPct * preset.ivFactor), ivAfterPct.min, ivAfterPct.max),
    daysPass: 1,
  };
}

/** Whether the sliders sit exactly on a preset. @param {OvernightInputs} inputs normalized inputs */
export function presetMatches(inputs, preset) {
  const want = applyPreset(preset, inputs.ivNowPct);
  return inputs.movePct === want.movePct && inputs.ivAfterPct === want.ivAfterPct && inputs.daysPass === want.daysPass;
}
