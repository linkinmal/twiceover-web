/**
 * WCAG 2.1 relative-luminance contrast arithmetic — (L1+0.05)/(L2+0.05). Mirrors
 * ai-team/design/tokens/ledger-contrast-check.py (stock-analyst-platform), the
 * canonical Python reference `build-tokens.mjs`'s own comment claims this is a
 * mirror of. `int(h[i:i+2], 16)` in that reference raises on malformed input;
 * this used to silently return NaN instead (ADR 0157 §Context point 3) — a
 * malformed hex made `NaN < need` evaluate `false` in JS, so the gate reported
 * "contrast gate OK" on garbage input rather than failing the build.
 */

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function channel(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a 6-digit hex color. Throws on anything else (8-digit
 *  ARGB shadow colors, 3-digit shorthand, non-hex strings) rather than returning
 *  NaN — a malformed value must fail the build, never pass silently. */
export function luminance(hex) {
  if (typeof hex !== "string" || !HEX_RE.test(hex)) {
    throw new Error(`luminance(): not a 6-digit hex color: ${JSON.stringify(hex)}`);
  }
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two 6-digit hex colors. */
export function ratio(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
