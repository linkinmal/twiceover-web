/**
 * The Macro board's tile, as the product draws it (twiceover-app `apps/web/src/read/MacroBoard.tsx` and
 * `macro-board.ts`; spine §4c v3.89–v4.02, stock-analyst-platform#4415/#4432/#4438). It replaces the
 * risk-appetite gauge and the regime words, which the product retired (#4415: "retire our own labels,
 * signals"). Each tile is one graph of four points, a year ago, 3 months ago, a month ago and now, inside
 * the year's low-to-high band. The line is one ink: nothing is coloured by direction, and no tile carries
 * a computed change, an arrow or a state word (spine §4c, Forbidden).
 *
 * String builders, like `hero-deck-svg.mjs` beside it. The rows are the page's one fixture
 * (`MACRO_BOARD`, `site-fixture.mjs`), made up like the rest of it; the value and date formats and the
 * graph's geometry are the app's own small-tile measures. A card asks for the width it renders at, so
 * the 11px type draws at true size; the caption set follows the width the way the app's does.
 */
import { MACRO_BOARD } from "./site-fixture.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const LONG_CAPTIONS = ["Year ago", "3 mo ago", "Month ago", "Now"];
export const SHORT_CAPTIONS = ["1y ago", "3m ago", "1m ago", "Now"];

/** A value as the tile prints it: the row's decimals, thousands grouped, a true minus sign, its unit. */
export function formatBoardValue(value, row) {
  const n = Number(value);
  const [whole, frac] = Math.abs(n).toFixed(row.decimals).split(".");
  const body = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac !== undefined ? `.${frac}` : "");
  return `${n < 0 ? "−" : ""}${body}${row.unit}`;
}

/** Daily rows: day and month (`28 Aug`), with the year when it is not the latest value's. Monthly
 *  rows: month and year (`Jul 2026`). */
export function formatBoardDate(iso, row, nowYear) {
  const [y, mo, d] = iso.split("-");
  const month = MONTHS[Number(mo) - 1];
  if (row.kind !== "level") return `${month} ${y}`;
  return `${Number(d)} ${month}${y !== nowYear ? ` ${y}` : ""}`;
}

/** The long captions while each fits its column with 6px either side (11px sans, ~5.4px a character,
 *  the app's own no-canvas estimate), else the short set. */
export function captionsFor(width) {
  const col = width / 4;
  return LONG_CAPTIONS.every((c) => c.length * 5.4 + 6 <= col) ? LONG_CAPTIONS : SHORT_CAPTIONS;
}

/** What a tile states above its graph: the latest value and its date, and the year's range. */
export function macroTile(key) {
  const row = MACRO_BOARD[key];
  const [nowIso, nowValue] = row.points[row.points.length - 1];
  const nowYear = nowIso.slice(0, 4);
  return {
    name: row.name,
    value: formatBoardValue(nowValue, row),
    iso: nowIso,
    date: formatBoardDate(nowIso, row, nowYear),
    low: formatBoardValue(row.range[0], row),
    high: formatBoardValue(row.range[1], row),
  };
}

/** One tile's graph at `width` px, as a whole `<svg>`. `cls` lets a card carry a desk and a phone twin. */
export function macroGraphSvg(key, width, cls = "") {
  const row = MACRO_BOARD[key];
  const w = width;
  const n = row.points.length;
  const capH = 16;
  const padT = 17;
  const padB = 19;
  const ph = 70;
  const h = ph + capH;
  const values = row.points.map(([, v]) => Number(v));
  const lo = Math.min(...values, Number(row.range[0]));
  const hi = Math.max(...values, Number(row.range[1]));
  const span = hi - lo || 1;
  const col = w / n;
  const X = (k) => col * (k + 0.5);
  const Y = (v) => padT + ((hi - v) / span) * (ph - padT - padB);
  const caps = captionsFor(w);
  const label = `${row.name}: ${row.points.map(([, v], k) => `${caps[k]} ${formatBoardValue(v, row)}`).join(", ")}`;
  const bandTop = Y(Number(row.range[1])) - 6;
  const bandH = Y(Number(row.range[0])) - Y(Number(row.range[1])) + 12;
  const dots = row.points
    .map(([, v], k) => {
      const last = k === n - 1;
      const up = (n - 1 - k) % 2 === 0;
      const y = Y(Number(v));
      return (
        `<circle class="${last ? "macro-graph__now" : "macro-graph__old"}" cx="${X(k).toFixed(1)}" cy="${y.toFixed(1)}" r="${last ? 4 : 2.6}"/>` +
        `<text class="macro-graph__value${last ? " macro-graph__value--now" : ""}" x="${X(k).toFixed(1)}" y="${(up ? y - 8 : y + 15).toFixed(1)}" text-anchor="middle">${formatBoardValue(v, row)}</text>`
      );
    })
    .join("");
  const captions = caps
    .map((c, k) => `<text class="macro-graph__cap${k === n - 1 ? " macro-graph__cap--now" : ""}" x="${X(k).toFixed(1)}" y="${ph + 12}" text-anchor="middle">${c}</text>`)
    .join("");
  return (
    // max-width: the graph shrinks with a narrow card but never grows past the width its 11px type was
    // drawn for (Designer gate, twiceover-web PR 165).
    `<svg class="mb-graph${cls ? ` ${cls}` : ""}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="max-width:${w}px" role="img" aria-label="${label}">` +
    `<rect class="macro-graph__band" x="0" y="${bandTop.toFixed(1)}" width="${w}" height="${bandH.toFixed(1)}" rx="4"/>` +
    `<polyline class="macro-graph__path" points="${row.points.map(([, v], k) => `${X(k).toFixed(1)},${Y(Number(v)).toFixed(1)}`).join(" ")}"/>` +
    dots +
    captions +
    `</svg>`
  );
}
