/**
 * The reports "Guess the gap" deals, baked in at build (blog-handoff-playables.md section 1; blog.md ruling 8). A game is
 * one set of five; "Play five more" deals the next set. Growth chooses the reports and checks each at its source before
 * publish. A priced move is options-derived (ADR 1106 Decision 2), and each post's pull request lists them.
 *
 * Each report: company, report date (YYYY-MM-DD), the move options had priced and the next-day close-to-close move
 * (each in tenths of a percent, the move signed), `source` (where the move was checked) and `checkedAt` (the date it was).
 *
 * WHAT IS HERE IS NOT THE CHECKED SET. The figures are the design artifact's invented samples, so the page can be built
 * and tested. guess-gap-reports.test.mjs refuses any report with no `source` and `checkedAt`: it fails until Growth's
 * checked set replaces this file. Nothing ships before that.
 */
export const REPORT_SETS = Object.freeze([
  [
    { company: "Sample Co. A", date: "2025-07-24", pricedTenths: 51, movedTenths: 112 },
    { company: "Sample Co. B", date: "2025-07-30", pricedTenths: 74, movedTenths: -30 },
    { company: "Sample Co. C", date: "2025-08-05", pricedTenths: 42, movedTenths: 11 },
    { company: "Sample Co. D", date: "2025-08-21", pricedTenths: 90, movedTenths: -146 },
    { company: "Sample Co. E", date: "2025-09-04", pricedTenths: 63, movedTenths: 58 },
  ].map((r) => Object.freeze(r)),
].map((s) => Object.freeze(s)));

/** The stamp under the lesson: where the figures come from. Growth's wording; it must name the real source of the checked set. */
export const SOURCE_LINE = "Closing prices. Each priced move is computed from option prices the day before the report.";
