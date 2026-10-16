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

export const BAD_NUMBER = "One of these numbers is out of range. The page still shows the last numbers that worked.";

const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One labelled box. The unit sits at the box, so a reader does not type 246 for $2.46. The value is escaped. */
export function rowHtml(id, label, value, u) {
  return `<div class="trow"><label for="${id}">${label}${u ? ` <span class="u">${u}</span>` : ""}</label><input id="${id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(value)}" aria-describedby="${id}-x"><small id="${id}-x" hidden></small></div>`;
}
