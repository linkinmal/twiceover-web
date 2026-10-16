/**
 * coin-game — the math behind "The 60% coin" playable (ADR 1090 Decision 8; the design's
 * `blog-handoff.md` §5.1; behavioural reference `blog-kit-2026-10-10-v2.html`, "the coin game").
 *
 * A fair-to-the-player coin: it wins 60% of the time, even money. The player stakes a share of the
 * current stack on each flip, starting at $25. The game ends at the $250 cap (a win that would pass it
 * is clamped to it), when the stack falls below $2 (bust), or after 300 flips ("neither").
 *
 * Two kinds of randomness, kept apart so the page can promise both: the reader's own game uses a
 * generator the page seeds from the clock, and **the 2,000-game bars always use seed 1987**, so every
 * visit shows the same figures. Nothing here reads the clock or stores anything.
 *
 * Pure functions shared by the build (the finished page carries the bars) and the block script.
 */

export const COIN = Object.freeze({
  winChance: 0.6,
  start: 25,
  cap: 250,
  bustBelow: 2,
  maxFlips: 300,
  /** The bet chips: 5, 10, 20, 40, 60, 100% of the current stack. */
  fractions: Object.freeze([0.05, 0.1, 0.2, 0.4, 0.6, 1]),
  barsSeed: 1987,
  barsGames: 2000,
});

/**
 * mulberry32 — a small seeded generator, the same one the design's prototype used so the published
 * bars stay the published bars.
 * @param {number} seed any integer; only its low 32 bits count
 * @returns {() => number} a function returning numbers in [0, 1)
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One flip.
 * @param {number} stack the stack before the flip
 * @param {number} fraction the share of the stack staked
 * @param {() => number} rng
 * @param {number} flipNumber this flip's place in the game, 1-based
 * @returns {{bet:number, heads:boolean, stack:number, over:boolean, outcome:'cap'|'bust'|'limit'|null}}
 */
export function flip(stack, fraction, rng, flipNumber) {
  const bet = stack * fraction;
  const heads = rng() < COIN.winChance;
  let next = stack + (heads ? bet : -bet);
  if (next >= COIN.cap) next = COIN.cap;
  const outcome = next >= COIN.cap ? "cap" : next < COIN.bustBelow ? "bust" : flipNumber >= COIN.maxFlips ? "limit" : null;
  return { bet, heads, stack: next, over: outcome !== null, outcome };
}

/**
 * Play a game on to its end from wherever it stands.
 * @param {number[]} run the stack after each flip so far, starting with the opening stack
 * @param {number} fraction the share staked from here on
 * @param {() => number} rng
 * @returns {{run:number[], outcome:'cap'|'bust'|'limit'}} the whole run and how it ended; a run already over comes back unchanged
 */
export function playToEnd(run, fraction, rng) {
  const out = run.slice();
  const finished = (w, flips) => w >= COIN.cap || w < COIN.bustBelow || flips >= COIN.maxFlips;
  const classify = (w) => (w >= COIN.cap ? "cap" : w < COIN.bustBelow ? "bust" : "limit");
  if (finished(out[out.length - 1], out.length - 1)) return { run: out, outcome: classify(out[out.length - 1]) };
  let outcome = null;
  while (outcome === null) {
    const step = flip(out[out.length - 1], fraction, rng, out.length);
    out.push(step.stack);
    outcome = step.outcome;
  }
  return { run: out, outcome };
}

/**
 * 2,000 seeded games at one bet size: whole percents, and the middle game's end stack.
 * The middle game is the 1,001st of the 2,000 sorted end values (index 1,000), as the signed-off kit
 * takes it; the design's handoff text is being corrected to match.
 * @param {number} fraction
 * @returns {{cap:number, bust:number, neither:number, median:number}}
 */
export function simulateBars(fraction) {
  const rng = createRng(COIN.barsSeed);
  let cap = 0;
  let bust = 0;
  const ends = [];
  for (let g = 0; g < COIN.barsGames; g++) {
    const { run, outcome } = playToEnd([COIN.start], fraction, rng);
    ends.push(run[run.length - 1]);
    if (outcome === "cap") cap++;
    else if (outcome === "bust") bust++;
  }
  const pct = (n) => Math.round((n / COIN.barsGames) * 100);
  ends.sort((a, b) => a - b);
  return { cap: pct(cap), bust: pct(bust), neither: 100 - pct(cap) - pct(bust), median: ends[COIN.barsGames / 2] };
}

/** The bars for every bet chip, in chip order. */
export function barsAll() {
  return COIN.fractions.map((fraction) => ({ fraction, ...simulateBars(fraction) }));
}

/**
 * The figures the lesson quotes, taken from the bars so the sentence can never disagree with them.
 * @param {{fraction:number, cap:number, bust:number}[]} bars
 */
export function lessonFigures(bars) {
  const row = (f) => bars.find((b) => b.fraction === f);
  return {
    at10: { cap: row(0.1).cap, bust: row(0.1).bust },
    at20: { bust: row(0.2).bust },
    at40: { bust: row(0.4).bust },
    at100: { bust: row(1).bust },
  };
}

/** Whole dollars from $100, cents below. */
export function formatMoney(w) {
  return "$" + (w >= 100 ? Math.round(w) : w.toFixed(2));
}
