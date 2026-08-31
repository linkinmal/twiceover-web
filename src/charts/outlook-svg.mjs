/**
 * The Outlook projection path chart's drawing half — the model from `outlook-chart.mjs` rendered as
 * SVG body markup. Ported from `twiceover-app` `apps/web/src/read/OutlookPathChart.tsx`
 * (origin/main 5d72e2c9), stock-analyst-platform#2987.
 *
 * **A string builder rather than markup inside the `.astro` component, for two reasons.** The share
 * image (#2988) must be generated from the SAME source as the hero or the two drift apart, and it
 * renders through `@resvg/resvg-js` in a plain Node script that cannot execute an Astro component.
 * And this repo's tests assert against modules, not rendered components, so a builder is the form
 * that can actually be exercised in isolation.
 *
 * **What this chart is allowed to say.** No signal colour anywhere: the Outlook is indicative by
 * construction and a green or red path would read as a verdict. No horizon price as chart text — every
 * figure is stated in the cards below, and the hover `<title>` is a tooltip, not a rendering. And the
 * last-close figure is NOT drawn here at all: it renders as a caption above the SVG (`.chartcap`), the
 * signed artifact's placement, because on the dip shape the path descends into the label's own band
 * and the near dot lands on it. That is the class of bug the artifact named "furniture placed in the
 * data's own region", and no vertical offset solves it — so the label leaves the plot.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

/** Trims float noise out of the emitted coordinates — the geometry is exact, the markup needn't be. */
function n(v) {
  return Number(v.toFixed(2));
}

/**
 * @param {ReturnType<import("./outlook-chart.mjs").projectionChartModel>} m
 * @param {{ compact: boolean, horizons: ReadonlyArray<{horizon: string, price: number|null}>,
 *           labels: Record<string, string> }} opts
 * @returns {string} the SVG body — the caller supplies the `<svg>` element and its viewBox.
 */
export function outlookPathSvgBody(m, { compact, horizons, labels }) {
  const parts = [];

  // The last-close reference line — the LINE only. Its figure is the caption above the plot.
  parts.push(
    `<line class="k-spotline" x1="${m.padLeft}" y1="${n(m.spotLine.y)}" x2="${m.width - m.padRight}" y2="${n(m.spotLine.y)}"/>`,
  );

  // The today-rule, drawn BEFORE the path and the points so both paint over it where they cross —
  // document order is what decides that in SVG.
  parts.push(
    `<line class="k-today" x1="${n(m.origin.x)}" y1="${m.padTop}" x2="${n(m.origin.x)}" y2="${m.height - m.padBottom}"/>`,
  );
  // TODAY + the read's own date, CENTERED on that rule: centering needs only half the label's width
  // clear per side, where right-aligning needed all of it and clipped at the compact breakpoint.
  // Font comes from the class, never an SVG presentation attribute — a bare attribute loses to
  // ambient page CSS and renders in a font nobody specified.
  parts.push(
    `<text class="k-tick" x="${n(m.origin.x)}" y="11" text-anchor="middle">${esc(m.origin.axisLabel.tick)}</text>`,
    `<text class="k-sub" x="${n(m.origin.x)}" y="${compact ? 21 : 22}" text-anchor="middle">${esc(m.origin.axisLabel.sub)}</text>`,
  );

  for (const s of m.segments) {
    parts.push(
      `<line class="k-seg" x1="${n(s.from.x)}" y1="${n(s.from.y)}" x2="${n(s.to.x)}" y2="${n(s.to.y)}"/>`,
    );
  }

  // A dark horizon draws a placeholder, never a point and never a bridged segment.
  for (const d of m.darkMarks) {
    parts.push(
      `<text class="k-dark" x="${n(d.x)}" y="${m.height / 2}" text-anchor="middle">· · ·</text>`,
    );
  }

  const r = compact ? 4 : 5;
  parts.push(`<circle class="k-origin" cx="${n(m.origin.x)}" cy="${n(m.origin.y)}" r="${r}"/>`);
  for (const p of m.points) {
    parts.push(`<circle class="k-point" cx="${n(p.x)}" cy="${n(p.y)}" r="${r}"/>`);
  }

  // Axis captions — horizons only; the origin's is the TODAY caption above.
  for (const p of m.points) {
    parts.push(
      `<text class="k-tick" x="${n(p.x)}" y="${m.height - 20}" text-anchor="middle">${esc(p.axisLabel.tick)}</text>`,
      `<text class="k-sub" x="${n(p.x)}" y="${m.height - 8}" text-anchor="middle">${esc(p.axisLabel.sub)}</text>`,
    );
    const price = horizons.find((h) => h.horizon === p.key)?.price;
    if (price != null) {
      // The figure travels with its attribution marker even in a tooltip, so a tooltip screenshot is
      // still attributed.
      parts.push(
        `<circle class="k-hit" cx="${n(p.x)}" cy="${n(p.y)}" r="14">` +
          `<title>${esc(labels[p.key])} — Our projection lands at $${price.toFixed(2)}</title>` +
          `</circle>`,
      );
    }
  }

  return parts.join("");
}
