/**
 * guess-gap — the math behind "Guess the gap" (ai-team/design/blog-handoff-playables.md section 1; reference artifact
 * blog-sources-guess-gap-2026-10-12.html).
 *
 * A report is {company, date, pricedTenths, movedTenths}: the move options had priced and the next-day close-to-close
 * move, each in tenths of a percent (51 is 5.1%), the move signed. The reader guesses a size, not a direction, so every
 * comparison is on |moved|. Everything here is integer arithmetic on tenths, so a guess exactly 2.0 points away is a
 * hit (4.1 − 2.1 is 2.0000000000000004 in floating point) and a ratio of exactly 1.8 reads as 1.8.
 *
 * Pure functions, no DOM and no clock: the build imports this to print the page's first question and its answers and
 * the block script in `public/js/` imports it to play. Wording is in guess-gap-view.mjs.
 */

export const MAX_TENTHS = 300; // the slider and the meter run 0 to 30%
export const STEP_TENTHS = 5; // in steps of 0.5
export const HIT_TENTHS = 20; // a guess within 2 points is a hit
export const SET_SIZE = 5;

const size = (r) => Math.abs(r.movedTenths);

/** Half up, a / b to the nearest integer, for non-negative integers. */
const roundDiv = (a, b) => Math.floor((2 * a + b) / (2 * b));

/**
 * How the move compares with the priced move: 'times' at 1.8 and above (with the ratio to one decimal), 'more' above
 * 1.15, 'close' from 0.85, else 'inside'. Boundaries are compared as exact integers: ratio ≥ 1.8 is 10a ≥ 18p.
 * @returns {{tier: "times" | "more" | "close" | "inside", ratioTenths: number}}
 */
export function ratioTier(r) {
  const a = size(r);
  const p = r.pricedTenths;
  const ratioTenths = roundDiv(10 * a, p);
  if (10 * a >= 18 * p) return { tier: "times", ratioTenths };
  if (20 * a > 23 * p) return { tier: "more", ratioTenths };
  if (20 * a >= 17 * p) return { tier: "close", ratioTenths };
  return { tier: "inside", ratioTenths };
}

/** How far a guess (tenths of a percent) is from the size of the move, in tenths of a point. */
export const offTenths = (r, guessTenths) => Math.abs(guessTenths - size(r));

export const hit = (r, guessTenths) => offTenths(r, guessTenths) <= HIT_TENTHS;

/** Hits, guesses made and the average miss in tenths of a point (half up), over the guesses actually made. */
export function score(set, guesses) {
  let played = 0;
  let hits = 0;
  let sum = 0;
  set.forEach((r, k) => {
    const g = guesses[k];
    if (g === null || g === undefined) return;
    played++;
    sum += offTenths(r, g);
    if (hit(r, g)) hits++;
  });
  return { played, hits, avgTenths: played ? roundDiv(sum, played) : 0 };
}

/** In how many of the reports the stock moved less than options had priced. */
export const insideCount = (set) => set.filter((r) => size(r) < r.pricedTenths).length;

/**
 * Problems with the report sets the page would bake in: each a line a person can fix. Empty means usable. This is the
 * shape check; that each report was checked at its source before publish is a separate release gate
 * (guess-gap-reports.test.mjs).
 * @param {Array<Array<{company: string, date: string, pricedTenths: number, movedTenths: number}>>} sets
 */
export function validateSets(sets) {
  const problems = [];
  if (!Array.isArray(sets) || sets.length === 0) return ["there is no report set"];
  sets.forEach((set, i) => {
    if (!Array.isArray(set) || set.length !== SET_SIZE) problems.push(`set ${i + 1}: a game is exactly ${SET_SIZE} reports`);
    const seen = new Set();
    (set ?? []).forEach((r, k) => {
      const at = `set ${i + 1}, report ${k + 1}`;
      if (!r || typeof r.company !== "string" || r.company.trim() === "") problems.push(`${at}: the company is missing`);
      if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") || Number.isNaN(Date.parse(r.date))) problems.push(`${at}: the report date must be YYYY-MM-DD`);
      for (const [key, label] of [["pricedTenths", "priced move"], ["movedTenths", "next-day move"]]) {
        const v = r?.[key];
        if (!Number.isInteger(v)) problems.push(`${at}: the ${label} must be a whole tenth of a percent`);
        else if (Math.abs(v) > MAX_TENTHS) problems.push(`${at}: the ${label} is past 30%, the end of the slider`);
      }
      if (Number.isInteger(r?.pricedTenths) && r.pricedTenths <= 0) problems.push(`${at}: the priced move must be above zero`);
      const id = `${r?.company}|${r?.date}`;
      if (seen.has(id)) problems.push(`${at}: ${r.company} on ${r.date} is in the set twice`);
      seen.add(id);
    });
  });
  return problems;
}
