/**
 * The technicals & levels price line's drawing half — the model from `technicals-chart.mjs` rendered
 * as SVG body markup. Ported from `twiceover-app` `apps/web/src/read/TechnicalsPriceChart.tsx`
 * (origin/main 33598666), stock-analyst-platform#2992.
 *
 * A string builder rather than markup inside the `.astro` component, for the same two reasons
 * `outlook-svg.mjs` documents: this repo's tests assert against modules rather than rendered
 * components, and a builder is the form that can be exercised in isolation.
 *
 * **Ink only — deliberately NOT `accent-surface.*`.** ADR 0008 Amendment 2 reserves the bronze accent
 * surface to the Outlook·Paths pair, and `outlook-svg.mjs` sitting beside this file is the nearest
 * chart in the repo and specifically NOT the token precedent here. §4b names that trap by file.
 *
 * **Level rules draw BEFORE the price line**, so the line paints over them: the line must read as the
 * subject and a rule as context, which stacking order carries as much as weight does.
 *
 * **No account-derived mark.** No cost basis, no P&L shading, nothing keyed to a position — the
 * builder takes no position data at all, which makes it structural rather than a rule to remember.
 *
 * **A crowded level is withheld as a PAIR — rule and both label lines together, never the label
 * alone** (stock-analyst-platform#3019, lightweight-log 2026-08-31; Designer BLOCK on this PR, ruled
 * Option 2). Two admitted levels close in price can sit closer together than their two-line label
 * blocks are tall — measured on this fixture at 1.97–7.62px of overlap — and §4b bars a rule rendered
 * without its name+value, so dropping just the label is not a legal fix. Mirrors twiceover-app
 * `TechnicalsPriceChart.tsx`'s independent fix (twiceover-app PR #1096, same Architect ruling): reuses
 * `clearOfPlaced`, already exported by `payoff-chart.mjs`, rather than a second copy of it.
 */

import { clearOfPlaced } from "./payoff-chart.mjs";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

/** Trims float noise out of the emitted coordinates — the geometry is exact, the markup needn't be. */
function n(v) {
  return Number(v.toFixed(2));
}

/** Minimum centre-to-centre vertical spacing, in viewBox units, between two levels' rules before their
 *  label blocks smear together. Each level carries two 8.5px-type lines (name at `y-1`, value at
 *  `y+8`); #3019/this PR's own pinned test measured 1.97–7.62px of real overlap at 17–18.5px of
 *  separation, so the true footprint runs past the bare 9px line spacing once glyph ascent/descent are
 *  counted. Set with headroom over the worst measured overlap, matching twiceover-app's identically
 *  reasoned `LEVEL_LABEL_MIN_GAP`. */
const LEVEL_LABEL_MIN_GAP = 26;

/**
 * @param {ReturnType<import("./technicals-chart.mjs").priceLineChartModel>} m
 * @param {{ compact: boolean }} opts
 * @returns {string} the SVG body — the caller supplies the `<svg>` element and its viewBox.
 */
export function technicalsPriceSvgBody(m, { compact }) {
  const parts = [];
  const plotRight = m.width - m.padRight;

  // Withhold a crowded level as a pair (#3019). `m.levels` is already in nearest-to-price priority
  // order — the same order `technicals-chart.mjs`'s own admission sort produces — so the nearer,
  // more likely to be what the reader is orienting by, wins a collision and the further one yields.
  const placedLevelYs = [];
  const shownLevels = m.levels.filter((level) => {
    if (!clearOfPlaced(placedLevelYs, level.y, LEVEL_LABEL_MIN_GAP)) return false;
    placedLevelYs.push(level.y);
    return true;
  });

  // Level rules first, so the price line draws OVER them. A rule NEVER renders without both its name
  // and its value — a bare rule is a §4b forbidden state, which is why the two texts are emitted in
  // the same block as the line rather than anywhere they could be dropped independently.
  for (const level of shownLevels) {
    parts.push(
      `<line class="t-level" x1="${m.padLeft}" y1="${n(level.y)}" x2="${n(plotRight)}" y2="${n(level.y)}"/>`,
      `<text class="t-level-name" x="${n(plotRight + 4)}" y="${n(level.y - 1)}">${esc(level.name)}</text>`,
      `<text class="t-level-value" x="${n(plotRight + 4)}" y="${n(level.y + 8)}">${esc(level.value)}</text>`,
    );
  }

  parts.push(
    `<polyline class="t-line" points="${m.points.map((p) => `${n(p.x)},${n(p.y)}`).join(" ")}"/>`,
  );

  // Month-boundary ticks, composed by the model from each session's own date.
  for (const tick of m.ticks) {
    parts.push(
      `<text class="t-tick" x="${n(tick.x)}" y="${m.height - 4}" text-anchor="middle">${esc(tick.label)}</text>`,
    );
  }

  // The last point and its figure — the only marked point, and the only figure on the chart.
  // Anchored INSIDE the plot, to the LEFT of the point (`text-anchor="end"`), never to its right:
  // `m.last.x` is algebraically `plotRight`, the same column the level name/value labels render in.
  // The last close is also the price admission sorts by, so the level most likely to be admitted is
  // also the one whose y sits closest to this figure's — a right-anchored figure would paint its
  // opaque knockout ring over that label and erase it, itself a §4b forbidden state. Anchoring left
  // removes the collision structurally rather than by nudging pixels.
  parts.push(
    `<circle class="t-last" cx="${n(m.last.x)}" cy="${n(m.last.y)}" r="${compact ? 2.5 : 3}"/>`,
    `<text class="t-lastv" text-anchor="end" x="${n(m.last.x - 6)}" y="${n(m.last.y - 5)}">${esc(m.last.value)}</text>`,
  );

  return parts.join("");
}
