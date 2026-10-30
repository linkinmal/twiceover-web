/**
 * position-size — the math behind "Position size and risk of ruin" (definition.md beside this file; Growth's page
 * notes in stock-analyst-platform ai-team/growth/blog-playables-routine.md section 4).
 *
 * One run is 100 trades. Each trade risks the same share f of the account as it stands; a win (chance p) adds
 * f × b × account, a loss takes f × account. After w wins and l losses the account is (1 + f·b)^w × (1 − f)^l of the
 * start, whatever the order. A run whose account is at or below half the start after any trade stops there ("fell to
 * the floor"); a run that never did and ends above the start is "ahead". The two shares are exact probabilities from
 * a walk over (trade, wins so far), not a simulation, so there is no seed and every visit shows the same figures.
 *
 * The typed odds are held in tenths of a percent, so the edge and the fastest-growing size are integer arithmetic and
 * a tie rounds the way the definition says. The account levels are compared in logs with a small tolerance, so an
 * exact tie (a 50% size with a 200% payoff lands on exactly half) counts as at the floor.
 *
 * Pure functions, no DOM and no clock: the build imports this to print the opening state and the block script
 * (client.mjs) imports it to recompute on input, so both print the same numbers. Wording is in position-size-view.mjs.
 */

/** The page opens on the first; "Try another example" deals one of the other five. Win chance and payoff in percent. */
export const EXAMPLES = Object.freeze([
  { win: 60, payoff: 100 },
  { win: 55, payoff: 100 },
  { win: 40, payoff: 200 },
  { win: 30, payoff: 300 },
  { win: 50, payoff: 150 },
  { win: 65, payoff: 60 },
].map((e) => Object.freeze(e)));
export const DEFAULT_EXAMPLE = 0;
export const DEFAULT_SIZE = 10;
export const TRADES = 100;
/** The bars' rows, in percent of the account. The slider's size is added in its place when it is not one of them. */
export const SIZES = Object.freeze([1, 2, 5, 10, 20, 30, 50, 100]);
export const SIZE_MIN = 1;
export const SIZE_MAX = 100;

export const WIN_MESSAGE = "Type a chance from 1% to 99%. Showing the last good result.";
export const PAYOFF_MESSAGE = "Type a payoff from 1% to 1000%. Showing the last good result.";

/** A typed percent as whole tenths, half up. Trimming to 12 significant digits keeps 55.55 (binary 55.549…) at 556. */
export const tenthsOf = (x) => Math.round(Number((x * 10).toPrecision(12)));

/** Which typed boxes are bad, checked each on its own after rounding to a tenth. */
export function validateOdds(win, payoff) {
  const w = tenthsOf(win);
  const b = tenthsOf(payoff);
  const errors = {};
  if (!(w >= 10 && w <= 990)) errors.win = WIN_MESSAGE;
  if (!(b >= 10 && b <= 10000)) errors.payoff = PAYOFF_MESSAGE;
  return { ok: !errors.win && !errors.payoff, errors };
}

/**
 * The odds as the page holds them, with the two figures that do not depend on the size.
 * `edgeTenths`: p·b − (1 − p) in tenths of a percent, half away from zero. `kelly`: p − (1 − p)/b as a whole percent,
 * half up; `none` when the edge is zero or less, `under` when it is above zero but rounds to zero.
 * @param {number} win the win chance in percent
 * @param {number} payoff what a win pays, in percent of the amount risked
 */
export function runOdds(win, payoff) {
  const check = validateOdds(win, payoff);
  if (!check.ok) return { ok: false, errors: check.errors };
  const P = tenthsOf(win);
  const B = tenthsOf(payoff);
  // The edge in percent is num / 10000.
  const num = P * B - 1000 * (1000 - P);
  const edgeTenths = Math.sign(num) * Math.floor((2 * Math.abs(num) + 1000) / 2000);
  let kelly;
  if (num <= 0) kelly = { kind: "none" };
  else {
    const pct = Math.floor((2 * num + 10 * B) / (20 * B));
    kelly = pct === 0 ? { kind: "under" } : { kind: "pct", pct };
  }
  return { ok: true, P, B, edgeTenths, positive: num > 0, kelly };
}

const EPS = 1e-9;
const HALF = -Math.LN2;

/**
 * The exact shares of 100-trade runs that end ahead and that fall to half the start, at one size.
 *
 * Each share also says whether its outcome can happen at all (`can`) and whether every run ends in it (`all`), worked
 * out from which states are reachable, not from the probability: 1 − 0.6^100 is 1 in floating point, but it is not
 * certain, and the page must not print it as 100%.
 * @param {{P:number, B:number}} r the odds from runOdds
 * @param {number} size the share of the account risked on each trade, in whole percent
 * @returns {{ahead:{p:number, can:boolean, all:boolean}, floor:{p:number, can:boolean, all:boolean}}}
 */
export function outcomes(r, size) {
  const p = r.P / 1000;
  const f = size / 100;
  const up = Math.log1p(f * (r.B / 1000));
  const down = f >= 1 ? -Infinity : Math.log1p(-f);
  const level = (w, l) => w * up + (l === 0 ? 0 : l * down);
  // mass[w]: the chance a run is still going with w wins so far; reach[w]: whether any run is (0 < p < 1, so every
  // branch is taken by some run).
  let mass = [1];
  let reach = [true];
  let floor = 0;
  let floorCan = false;
  for (let t = 1; t <= TRADES; t++) {
    const nextMass = new Array(t + 1).fill(0);
    const nextReach = new Array(t + 1).fill(false);
    for (let w = 0; w < t; w++) {
      if (!reach[w]) continue;
      nextMass[w + 1] += mass[w] * p;
      nextMass[w] += mass[w] * (1 - p);
      nextReach[w + 1] = nextReach[w] = true;
    }
    for (let w = 0; w <= t; w++) {
      if (nextReach[w] && level(w, t - w) <= HALF + EPS) {
        floor += nextMass[w];
        floorCan = true;
        nextMass[w] = 0;
        nextReach[w] = false;
      }
    }
    mass = nextMass;
    reach = nextReach;
  }
  let ahead = 0;
  let aheadCan = false;
  let neitherCan = false;
  for (let w = 0; w <= TRADES; w++) {
    if (!reach[w]) continue;
    if (level(w, TRADES - w) > EPS) {
      ahead += mass[w];
      aheadCan = true;
    } else neitherCan = true;
  }
  return {
    ahead: { p: ahead, can: aheadCan, all: aheadCan && !floorCan && !neitherCan },
    floor: { p: floor, can: floorCan, all: floorCan && !aheadCan && !neitherCan },
  };
}

/** The bars' sizes for a slider position: the fixed rows, with the slider's own added in order when it is not one. */
export function barSizes(size) {
  return SIZES.includes(size) ? [...SIZES] : [...SIZES, size].sort((a, b) => a - b);
}

/** A slider value as a whole percent inside the slider's range. */
export const fitSize = (x) => Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(x)));
