/**
 * number-input — read a typed number the way the tool pages accept it (blog-handoff.md section 5): digits with an
 * optional decimal mark, a dot or a comma. Anything else (a sign, an exponent, a space inside, a thousands
 * separator, text) is not a number. Returns NaN for those, so the caller's range check marks the box invalid.
 */
const PLAIN = /^(\d+\.?\d*|\.\d+)$/;

/** @param {string} text what the reader typed */
export function readNumber(text) {
  const s = String(text).trim().replace(",", ".");
  return PLAIN.test(s) ? parseFloat(s) : NaN;
}

/** The text a box shows for a number: whole numbers bare, else two decimals. */
export function showNumber(x) {
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}
