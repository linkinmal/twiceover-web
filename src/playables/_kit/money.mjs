/**
 * money — the one dollar formatter the blog pages share (blog-handoff.md "Money and small figures on a page"):
 * thousands separators from $1,000 up, a per-share price at two decimals, a whole-dollar amount with none. The typed
 * boxes do not use it: they stay plain digits, because a comma is accepted there as a decimal mark.
 */

/** Commas into the whole-number part of a plain number string: "100000.00" becomes "100,000.00". */
export const groupThousands = (text) => {
  const [whole, ...rest] = String(text).split(".");
  return [whole.replace(/\B(?=(\d{3})+$)/g, ","), ...rest].join(".");
};

/** Whole cents as dollars and cents: 10000000 is "$100,000.00". */
export const dollarsFromCents = (cents) => "$" + groupThousands((cents / 100).toFixed(2));

/** A whole number of dollars, no decimals: a per-contract amount (price × 100) such as "$450,000". */
export const wholeDollars = (n) => "$" + groupThousands(Math.round(n));

/** A price as text: whole dollars bare, else cents ("$5,100" or "$1,074.60"). */
export const price = (x) => "$" + groupThousands(Number.isInteger(x) ? x : x.toFixed(2));
