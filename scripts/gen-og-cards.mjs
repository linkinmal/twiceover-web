#!/usr/bin/env node
/**
 * The site's share image — a rotating set of three cards (ADR 0905, stock-analyst-platform#2988 /
 * #3508). Run via `npm run gen:og-cards`; the PNGs are committed, like the favicons.
 *
 * **Why three files rather than one that changes.** Replacing the bytes at an existing `og:image`
 * URL changes nothing anyone sees: Meta documents it outright — *"We cache all images referenced
 * based on each image's URL, so if you replace an image: Use a new URL for the new image or the
 * image won't be updated"* — and every other consumer checked keys on URL too. So each member gets
 * its own stably-named asset that is never overwritten and never deleted, and `Base.astro` holds one
 * constant naming the live one. **Rotating the card is that one line plus a deploy** (README
 * §Rotating the share card).
 *
 * **Every plot is emitted by the site's own chart modules against `site-fixture.mjs`** — the same
 * builders the hero, the technicals panel and the before/after read use — so a member cannot drift
 * from what the product draws. `gen-og-cards.test.mjs` holds the other end of that: it rebuilds each
 * card's SVG from the modules and compares it against the committed `scripts/og-cards/*.svg`, so a
 * chart-module, fixture or token change fails CI instead of quietly leaving the artwork stale.
 *
 * **Two things the browser does that resvg does not, and how each is handled.**
 *
 *  - *Fonts.* resvg (2.6.2) cannot read woff2, and the repo's `public/fonts/*.woff2` are variable
 *    faces whose default instance is ExtraLight — resvg has no axis instancing, so every weight
 *    would render at wght 200 even after decompression. `scripts/og-fonts/` therefore holds four
 *    STATIC faces instanced at exactly the weights these cards use; see the README beside them for
 *    the command that produced them from the very same woff2.
 *  - *Layout.* The build reference is HTML/CSS (three artboards on the design canvas linked from
 *    #3508), which positions text by box edge; SVG positions it by baseline. The chassis constants
 *    below are the artboards' own rendered baselines, measured once in headless Chrome rather than
 *    derived from font metrics — recorded per constant so a later change can re-measure rather than
 *    guess.
 *
 * **The transforms.** The chart modules draw for the page, where their type is 8.5–10.5px in a
 * 620-unit viewBox. On a card seen at roughly 0.29x (X renders a large-image card at ~350px on a
 * phone) that lands under consult 0752's 6px-as-rendered floor, so each member's chart type is
 * scaled — and scaling alone is not enough, because the modules place a label's name and its value
 * on two baselines a FIXED number of units apart, spaced for the small type. Larger type in an
 * unchanged gap collides. So stacked pairs are merged onto one baseline, keyed on (x, y) — never y
 * alone, since all three of A's horizon ticks share one baseline and a y-only key collapses them
 * into whichever was parsed last. Line, point and path geometry is never touched.
 *
 * Every transform below is given the count it expects and throws when the input does not match, so a
 * change in a chart module surfaces here as a failed build rather than a silently wrong card.
 *
 * Whether these transforms should instead become a named share-card state of the chart components,
 * the way compact and desktop already are, is ADR 0905's own open question — Designer, #3509.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { projectionChartModel } from "../src/charts/outlook-chart.mjs";
import { outlookPathSvgBody } from "../src/charts/outlook-svg.mjs";
import { priceLineChartModel } from "../src/charts/technicals-chart.mjs";
import { technicalsPriceSvgBody } from "../src/charts/technicals-svg.mjs";
import { payoffChartModel } from "../src/charts/payoff-chart.mjs";
import { payoffSvgBody } from "../src/charts/payoff-svg.mjs";
import {
  HERO_OUTLOOK,
  HORIZON_CARDS,
  LAST_CLOSE_CAPTION,
  SPOT,
  SPREAD,
  SPREAD_PAYOFF,
  TECHNICALS,
  TECHNICALS_SERIES,
  money,
} from "../src/charts/site-fixture.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The one size every consumer is told to expect — `og:image:width`/`height` in `Base.astro`. */
export const CARD = { w: 1200, h: 630 };

/** Consult 0752's floor, in px AS RENDERED — set after an X banner shipped a 5.2px disclaimer. */
export const LEGIBILITY_FLOOR_PX = 6;
/** X renders a large-image card at roughly this width on a phone, so a 1200px card is seen at 0.29x. */
export const PHONE_CARD_WIDTH_PX = 350;

/* ── The chassis ─────────────────────────────────────────────────────────────────────────────────
   One composition for all three members: lockup, headline, caption line, plot, footer rail. Only
   the caption text, the disclaimer's placement and the plot body differ.

   Baselines and box edges are the build reference's own, measured in headless Chrome against the
   three artboards at 1200x630 (2026-09-04). CSS `top`/`bottom` cannot be transcribed into SVG `y`,
   which is a baseline; these are what the browser actually laid out. */
const CHASSIS = {
  /** The mark, 42x42 at the card's left margin — `public/favicon.svg`'s own two bars. */
  mark: { x: 80, y: 46, size: 42 },
  /** "TwiceOver", 32px serif 600. x is the mark's right edge + the lockup's 13px gap. */
  wordmark: { x: 135, baseline: 78 },
  /** "A second look / at your own book.", 46px serif 600, line-height 1.06 (48.76px). */
  tagline: { x: 80, baselines: [132, 180.75], lines: ["A second look", "at your own book."] },
  /** The member's caption line, 24px mono. */
  caption: { x: 80, baseline: 250 },
  /** twiceover.io, 22px sans 600, and the promise, 24px serif 600 — both on one rail. */
  foot: { x: 80, baseline: 589, text: "twiceover.io" },
  footRight: { x: 1120, baseline: 589, text: "Depth, never a verdict." },
};

/** The disclaimer travels with the figures wherever they go — 28px, right-aligned to the margin. */
const DISCLAIMER = "Illustrative example — not a live account";

/* ── The members ─────────────────────────────────────────────────────────────────────────────────
   `scale` is ADR 0905's build rule 1, solved per member from the legibility floor against that
   member's own plot width — not re-derived here, because the constant IS the recorded decision;
   `smallestRenderedPhonePx` checks it still clears the floor rather than recomputing it. */
export const MEMBERS = [
  {
    key: "path",
    file: "og-card-path.png",
    title: "A · the projection path",
    scale: 1.53,
    caption: LAST_CLOSE_CAPTION,
    plot: { x: 80, y: 262, width: 980 },
    disclaimer: { x: 1120, baselines: [253] },
  },
  {
    key: "levels",
    file: "og-card-levels.png",
    title: "B · the price line",
    scale: 1.67,
    caption: "last 90 sessions · the levels",
    plot: { x: 80, y: 290, width: 900 },
    disclaimer: { x: 1120, baselines: [253] },
  },
  {
    key: "spread",
    file: "og-card-spread.png",
    title: "C · the spread",
    scale: 1.9,
    caption: `your ${SPREAD.contracts}× ${SPREAD.expiry} ${SPREAD.lowerStrike}C/${SPREAD.upperStrike}C · breakeven ${money(SPREAD.breakeven)}`,
    plot: { x: 60, y: 250, width: 744 },
    // The spread's plot is tall enough to push the disclaimer below it, where it wraps in a 300px
    // column. Both lines' baselines are the artboard's own, measured with the rest of the chassis.
    disclaimer: { x: 1120, baselines: [358, 394.39], lines: ["Illustrative example —", "not a live account"] },
  },
];

export function memberByKey(key) {
  const m = MEMBERS.find((x) => x.key === key);
  if (!m) throw new Error(`unknown share-card member: ${key}`);
  return m;
}

/* ── Style: the site's own chart CSS, scaled and rebound ────────────────────────────────────────── */

/**
 * The chart classes each plot needs, spelled as they appear in `site.css`. Prefixed selectors carry
 * their prefix so the lookup is exact; the `--phone` overrides are deliberately absent, because the
 * card always renders a chart's DESKTOP state.
 *
 * Grouped per chart so a card embeds only its own plot's rules. A card carrying all three families
 * would render identically — the unused rules match nothing, measured: the PNGs came out
 * byte-for-byte the same — but it would also state, say, a `.k-tick` size scaled by the spread
 * card's factor, a number with no referent and an invitation to misread `scripts/og-cards/`.
 *
 * `gen-og-cards.test.mjs` holds the other end of this list: for every class a plot actually draws
 * with, if `site.css` styles it then the card must too. That is what keeps a hand-written list from
 * quietly going short.
 */
const CHART_SELECTORS = {
  // `.k-dark` styles the placeholder a horizon draws when its projection is withheld. Today's
  // fixture has no dark horizon, so it matches nothing — kept anyway, because it is a branch of
  // this chart rather than another chart's rule, and a fixture change must not silently render an
  // unstyled placeholder. `.pf-halo` by contrast went with the two callouts C strips: its only
  // consumers are gone for good.
  path: [".k-spotline", ".k-today", ".k-seg", ".k-origin", ".k-point", ".k-dark", ".k-tick", ".k-sub", ".k-hit"],
  levels: [
    ".t-chart .t-line", ".t-chart .t-level", ".t-chart .t-level-name", ".t-chart .t-level-value",
    ".t-chart .t-tick", ".t-chart .t-last", ".t-chart .t-lastv",
  ],
  spread: [
    ".pf-hatch", ".pf-zone-profit", ".pf-word", ".pf-grid", ".pf-zero", ".pf-line", ".pf-berule", ".pf-bedot",
    ".pf-maxloss-d", ".pf-maxprof-d", ".pf-tick--strike", ".pf-tick--breakeven", ".pf-tickfig",
    ".pf-tickfig--strike", ".pf-tickfig--breakeven",
  ],
};

/** Reads `src/styles/tokens.css` and `src/styles/site.css`, building tokens.css first if the
 *  build has not run — it is generated and gitignored (ADR 0004), so a bare `vitest` can miss it. */
export function loadStyleSources() {
  const tokensPath = join(root, "src/styles/tokens.css");
  if (!existsSync(tokensPath)) {
    execFileSync(process.execPath, [join(root, "scripts/build-tokens.mjs")], { stdio: "ignore" });
  }
  return {
    tokens: parseTokens(readFileSync(tokensPath, "utf8")),
    siteCss: readFileSync(join(root, "src/styles/site.css"), "utf8"),
  };
}

/** The LIGHT theme's semantic properties. Social crawlers do not run the viewer's theme, so the card
 *  is light-only by decision (#2988) and the `[data-theme="dark"]` block is never read. */
function parseTokens(css) {
  const light = css.slice(0, css.indexOf('[data-theme="dark"]') === -1 ? css.length : css.indexOf('[data-theme="dark"]'));
  const out = new Map();
  for (const [, name, value] of light.matchAll(/--([\w-]+):\s*([^;]+);/g)) out.set(name, value.trim());
  return out;
}

/** Pulls one selector's declaration block out of `site.css`. Throws rather than emitting a chart
 *  with a silently missing rule — a bare rule or an unstyled label is a forbidden state, not a
 *  cosmetic loss. */
function declarationsFor(siteCss, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^}]*)\\}`, "m");
  const hit = re.exec(siteCss);
  if (!hit) throw new Error(`site.css has no rule for '${selector}' — the card cannot style its chart`);
  return hit[1]
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
}

/**
 * The chart stylesheet the card embeds: the site's own rules, with every `font-size` multiplied by
 * the member's scale, every `var(--x)` resolved, and every knockout rebound to the card's own
 * background.
 *
 * **The rebind is #2988's halo note, generalised.** On the page these charts sit on the Outlook
 * band (`accent-surface.container`) or on a panel (`bg.surface`); on the card they sit directly on
 * `bg.canvas`. A knockout ring paints the surface it thinks is behind it, so leaving those bindings
 * alone would ring every point and figure in a colour that is not there. Rebinding by VALUE rather
 * than per class means a new knockout added to a chart later is covered without touching this file.
 */
export function chartStylesheet({ siteCss, tokens, scale, chart = "path" }) {
  const cardBg = tokens.get("color-bg-canvas");
  const behindOnThePage = [tokens.get("accent-surface-container"), tokens.get("color-bg-surface")];

  const rules = CHART_SELECTORS[chart].map((selector) => {
    const declarations = declarationsFor(siteCss, selector).map((d) => {
      let out = d.replace(/var\(--([\w-]+)\)/g, (_m, name) => {
        const v = tokens.get(name);
        if (v === undefined) throw new Error(`site.css '${selector}' reads unknown token --${name}`);
        return v;
      });
      out = out.replace(/font-size:\s*([\d.]+)px/, (_m, px) => `font-size:${(Number(px) * scale).toFixed(2)}px`);
      for (const surface of behindOnThePage) out = out.split(surface).join(cardBg);
      return out.replace(/\s*:\s*/, ":");
    });
    // `.t-chart .t-level-name` styles `.t-level-name` here: the card emits the chart body without
    // the component's wrapper class.
    const bare = selector.slice(selector.lastIndexOf(" ") + 1);
    return `${bare}{${declarations.join(";")}}`;
  });

  // The modules leave several labels without their own family, inheriting the page's sans. An SVG
  // has no such ambient inheritance, so the default is stated.
  rules.unshift(`text{font-family:${tokens.get("font-family-sans")}}`);
  return rules.join("\n");
}

/* ── Transforms ──────────────────────────────────────────────────────────────────────────────────
   Each takes the count it expects and throws on a miss. That throw is the point: it is the other
   end of "the card cannot drift from what the product draws". */

/**
 * Merges each `name`/`value` text pair onto the name's baseline, the value as a span after it.
 *
 * **Keyed on (x, y), never y alone.** `nameY` pins WHICH row of labels this merge is for, and the x
 * of the two texts must match — all three of A's horizon ticks sit on one baseline, so a y-only key
 * would fold them into a single label carrying the last date parsed.
 *
 * @param {string} body            the chart module's emitted SVG body
 * @param {object} opts
 * @param {string} opts.nameClass  class of the upper text
 * @param {string} opts.valueClass class of the lower text, which becomes the span
 * @param {number|null} opts.nameY the baseline this merge applies to, or null for "wherever a pair sits"
 * @param {number} opts.gap        the fixed baseline gap the module emits between the two
 * @param {string} opts.separator  what joins them on the merged baseline
 * @param {number} opts.expected   how many pairs must merge
 */
export function mergeStackedPairs(body, { nameClass, valueClass, nameY, gap, separator, expected }) {
  const pair = new RegExp(
    `<text class="${nameClass}"([^>]*?)\\bx="([\\d.-]+)"([^>]*?)\\by="([\\d.-]+)"([^>]*?)>([^<]*)</text>` +
      `<text class="${valueClass}"([^>]*?)\\bx="([\\d.-]+)"([^>]*?)\\by="([\\d.-]+)"([^>]*?)>([^<]*)</text>`,
    "g",
  );
  let merged = 0;
  const out = body.replace(pair, (whole, a1, nx, a2, ny, a3, nameText, b1, vx, b2, vy, b3, valueText) => {
    const sameColumn = nx === vx;
    const rightRow = nameY === null || Number(ny) === nameY;
    const rightGap = Math.abs(Number(vy) - Number(ny) - gap) < 0.01;
    if (!sameColumn || !rightRow || !rightGap) return whole;
    merged += 1;
    return (
      `<text class="${nameClass}"${a1}x="${nx}"${a2}y="${ny}"${a3}>` +
      `${nameText}${separator}<tspan class="${valueClass}">${valueText}</tspan></text>`
    );
  });
  if (merged !== expected) {
    throw new Error(
      `merge ${nameClass}/${valueClass}: expected ${expected} pair(s) at gap ${gap}` +
        `${nameY === null ? "" : ` on baseline ${nameY}`}, merged ${merged} — the chart module's label ` +
        `geometry has moved; re-check the card at phone size before changing this count`,
    );
  }
  return out;
}

/** Removes every element with the given class (`text`, `line`, …), asserting how many go. */
export function stripElements(body, { cls, tag = "text", expected }) {
  const re = new RegExp(`<${tag} class="${cls}"[^>]*(?:/>|>.*?</${tag}>)`, "g");
  const found = body.match(re) ?? [];
  if (found.length !== expected) {
    throw new Error(
      `strip ${tag}.${cls}: expected ${expected}, found ${found.length} — the payoff module's output ` +
        `has changed; C must carry no dollar outcome figure at all (ADR 0905)`,
    );
  }
  return body.replace(re, "");
}

/** Moves one element's `y`, asserting it was where we thought. */
function moveY(body, { cls, tag = "text", from, to, contains }) {
  const re = new RegExp(`(<${tag} class="${cls}"[^>]*\\by=")${from}("[^>]*>${contains}</${tag}>)`);
  if (!re.test(body)) {
    throw new Error(`move ${tag}.${cls} "${contains}": no element at y=${from} — geometry has moved`);
  }
  return body.replace(re, `$1${to}$2`);
}

/* ── The three plots ─────────────────────────────────────────────────────────────────────────────
   Each renders the chart module's DESKTOP state — never the compact one, and never a transform of
   it: the compact state re-spaces its own axis for a phone slot, which is not what this card is. */

/** A · the Outlook projection path across three horizons. */
function pathPlot() {
  const m = projectionChartModel({ ...HERO_OUTLOOK, compact: false });
  const labels = Object.fromEntries(HORIZON_CARDS.map((c) => [c.key, c.label]));
  let body = outlookPathSvgBody(m, { compact: false, horizons: HERO_OUTLOOK.horizons, labels });

  // The three horizon pairs sit on the axis baseline the module computes, 12 units apart.
  body = mergeStackedPairs(body, {
    nameClass: "k-tick",
    valueClass: "k-sub",
    nameY: m.height - 20,
    gap: 12,
    separator: " · ",
    expected: m.points.length,
  });
  // The TODAY pair is 11 units apart and is NOT merged: TODAY labels a vertical rule, and
  // "TODAY · AUG 31" on one baseline would read as a fourth horizon tick. The artifact separates
  // them instead — 5 units, which is what clears the ascenders at this member's scale.
  body = moveY(body, { cls: "k-sub", from: 22, to: 27, contains: m.origin.axisLabel.sub });

  return { m, body, smallestTypeUnits: 8.5 };
}

/** B · the technicals price line with its levels. */
function levelsPlot() {
  const m = priceLineChartModel({ series: TECHNICALS_SERIES, technicals: TECHNICALS, compact: false });
  let body = technicalsPriceSvgBody(m, { compact: false });

  // One pair per level the render layer actually admitted — the crowding rule (#3019) withholds
  // some candidates, so the count comes from the emitted rules rather than from `m.levels`.
  const shownLevels = (body.match(/<line class="t-level"/g) ?? []).length;
  body = mergeStackedPairs(body, {
    nameClass: "t-level-name",
    valueClass: "t-level-value",
    nameY: null,
    gap: 9,
    separator: " ",
    expected: shownLevels,
  });

  return { m, body, smallestTypeUnits: 8.5 };
}

/**
 * C · the held spread's payoff.
 *
 * **Every dollar OUTCOME figure is stripped** — the P&L axis, the max-profit and max-loss callouts
 * and both prose captions — leaving the shape, the two strikes and the breakeven. Prices of a
 * structure are not returns; a gain figure travelling alone on a share card reads as a track-record
 * claim, which `site-prelaunch.md` §1 already excludes from this surface. The last close's rule goes
 * with them: its own figure is not on the chart, but the rule without the caption it shares a row
 * with is a bare mark.
 */
function spreadPlot() {
  const m = payoffChartModel({ ...SPREAD_PAYOFF, compact: false });
  let body = payoffSvgBody(m, {
    compact: false,
    lastClose: SPOT,
    strikes: [SPREAD.lowerStrike, SPREAD.upperStrike],
    breakeven: SPREAD.breakeven,
    contracts: SPREAD.contracts,
    id: "og-spread",
  });

  body = stripElements(body, { cls: "pf-axis", expected: 4 });
  body = stripElements(body, { cls: "pf-cap", expected: 3 });
  body = stripElements(body, { cls: "pf-halo pf-figure", expected: 2 });
  body = stripElements(body, { cls: "pf-spotlab", expected: 1 });
  body = stripElements(body, { cls: "pf-spot", tag: "line", expected: 1 });

  // The model centres both zone words on the same row, which on the loss side is the row the payoff
  // line itself runs along. Lifted clear; the profit side's row is empty and stays.
  body = moveY(body, { cls: "pf-word", from: m.height - m.padBottom - 10, to: 150, contains: "loss at expiry" });

  // The smallest type left is the price ticks: the 9px axis figures went with the P&L axis.
  return { m, body, smallestTypeUnits: 9 };
}

const PLOTS = { path: pathPlot, levels: levelsPlot, spread: spreadPlot };

/** The member's plot: the chart module's body after this card's transforms, plus its viewBox. */
export function plotFor(key) {
  const { m, body, smallestTypeUnits } = PLOTS[memberByKey(key).key]();
  return { body, width: m.width, height: m.height, viewBox: `0 0 ${m.width} ${m.height}`, smallestTypeUnits };
}

/**
 * What the member's smallest label actually measures on a phone-sized card, in px.
 *
 * Three multiplications, none of them optional: the type is scaled inside a 620-unit viewBox, that
 * viewBox is drawn at the member's plot width, and the whole 1200px card is shown at ~350px.
 */
export function smallestRenderedPhonePx(key) {
  const member = memberByKey(key);
  const { smallestTypeUnits, width } = plotFor(key);
  const onCard = smallestTypeUnits * member.scale * (member.plot.width / width);
  return Number((onCard * (PHONE_CARD_WIDTH_PX / CARD.w)).toFixed(3));
}

/* ── The card ────────────────────────────────────────────────────────────────────────────────── */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** The composed 1200×630 card, as SVG. Deterministic and diffable — this, not the PNG, is what the
 *  drift test compares, because PNG bytes depend on the rasteriser's build. */
export function cardSvg(key, sources = loadStyleSources()) {
  const member = memberByKey(key);
  const { tokens } = sources;
  const plot = plotFor(key);
  const scale = member.plot.width / plot.width;

  const disc = member.disclaimer;
  const discLines = disc.lines ?? [DISCLAIMER];

  const chassisCss = [
    `.word{font-family:${tokens.get("font-family-serif")};font-weight:600;font-size:32px;fill:${tokens.get("color-text-primary")}}`,
    `.o{fill:${tokens.get("color-accent-default")}}`,
    `.tagline{font-family:${tokens.get("font-family-serif")};font-weight:600;font-size:46px;letter-spacing:-1.15px;fill:${tokens.get("color-text-primary")}}`,
    `.cap{font-family:${tokens.get("font-family-mono")};font-size:24px;fill:${tokens.get("accent-surface-on-surface-muted")}}`,
    `.disc{font-family:${tokens.get("font-family-sans")};font-size:28px;fill:${tokens.get("color-text-muted")}}`,
    `.foot{font-family:${tokens.get("font-family-sans")};font-weight:600;font-size:22px;fill:${tokens.get("text-link")}}`,
    `.foot-right{font-family:${tokens.get("font-family-serif")};font-weight:600;font-size:24px;fill:${tokens.get("color-text-primary")}}`,
  ].join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">`,
    `<style>`,
    chassisCss,
    chartStylesheet({ ...sources, scale: member.scale, chart: member.key }),
    `</style>`,
    `<rect width="${CARD.w}" height="${CARD.h}" fill="${tokens.get("color-bg-canvas")}"/>`,
    markSvg(tokens),
    `<text class="word" x="${CHASSIS.wordmark.x}" y="${CHASSIS.wordmark.baseline}">Twice<tspan class="o">O</tspan>ver</text>`,
    ...CHASSIS.tagline.lines.map(
      (line, i) => `<text class="tagline" x="${CHASSIS.tagline.x}" y="${CHASSIS.tagline.baselines[i]}">${esc(line)}</text>`,
    ),
    `<text class="cap" x="${CHASSIS.caption.x}" y="${CHASSIS.caption.baseline}">${esc(member.caption)}</text>`,
    ...discLines.map(
      (line, i) => `<text class="disc" text-anchor="end" x="${disc.x}" y="${disc.baselines[i]}">${esc(line)}</text>`,
    ),
    `<g transform="translate(${member.plot.x} ${member.plot.y}) scale(${Number(scale.toFixed(6))})">${plot.body}</g>`,
    `<text class="foot" x="${CHASSIS.foot.x}" y="${CHASSIS.foot.baseline}">${esc(CHASSIS.foot.text)}</text>`,
    `<text class="foot-right" text-anchor="end" x="${CHASSIS.footRight.x}" y="${CHASSIS.footRight.baseline}">${esc(CHASSIS.footRight.text)}</text>`,
    `</svg>`,
    ``,
  ].join("\n");
}

/** The "second look" mark, from `public/favicon.svg` — the canonical asset, not a second copy: its
 *  two bars are read out of the file so the card cannot drift from the favicon. */
function markSvg(tokens) {
  const favicon = readFileSync(join(root, "public/favicon.svg"), "utf8");
  const bars = [...favicon.matchAll(/<rect[^>]*\/>/g)].map((m) => m[0]);
  if (bars.length !== 2) throw new Error(`public/favicon.svg: expected the mark's 2 bars, found ${bars.length}`);
  const { x, y, size } = CHASSIS.mark;
  return (
    `<g transform="translate(${x} ${y}) scale(${size / 32})">` +
    bars.map((b) => b.replace(/fill="[^"]*"/, `fill="${tokens.get("color-accent-default")}"`)).join("") +
    `</g>`
  );
}

/* ── Rendering ───────────────────────────────────────────────────────────────────────────────── */

const FONT_DIR = join(root, "scripts/og-fonts");

async function renderPng(svg, width = CARD.w) {
  // Imported here rather than at module scope: everything above this line is pure string work, and
  // the tests exercise all of it. Loading the rasteriser's native binding to assert on an SVG would
  // make the whole suite depend on a platform binary it never uses.
  const { Resvg } = await import("@resvg/resvg-js");
  const fontFiles = readdirSync(FONT_DIR)
    .filter((f) => f.endsWith(".ttf"))
    .map((f) => join(FONT_DIR, f));
  if (fontFiles.length === 0) throw new Error(`no static faces in ${FONT_DIR} — see the README beside them`);
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: "Source Sans 3" },
  })
    .render()
    .asPng();
}

async function main() {
  const sources = loadStyleSources();
  mkdirSync(join(root, "scripts/og-cards"), { recursive: true });

  for (const member of MEMBERS) {
    const svg = cardSvg(member.key, sources);
    writeFileSync(join(root, "scripts/og-cards", `${member.key}.svg`), svg);
    const png = await renderPng(svg);
    writeFileSync(join(root, "public", member.file), png);
    console.log(
      `public/${member.file}  ${CARD.w}×${CARD.h}, ${png.length} bytes  ` +
        `(${member.title}, type ×${member.scale}, smallest ${smallestRenderedPhonePx(member.key)}px at ${PHONE_CARD_WIDTH_PX}px)`,
    );
  }

  // The pre-launch URL keeps resolving, serving A's artwork. Meta: "Don't remove old images, as
  // there maybe existing stories that reference the old image."
  copyFileSync(join(root, "public/og-card-path.png"), join(root, "public/og-image.png"));
  console.log("public/og-image.png  ← og-card-path.png (legacy URL, links shared before ADR 0905)");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
