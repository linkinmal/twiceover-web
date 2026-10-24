/**
 * The product pictures above the fold (site-prelaunch.md v2.54, stock-analyst-platform#4498; build
 * reference ai-team/design/assets/above-fold-pictures-4498-2026-10-24/, the artifact is what was signed
 * off). Two drawings live here: the analysis card's chart with its three horizon tiles, and the Large
 * options trades chart. Both are string builders, like `macro-board-svg.mjs` beside them, fed the made-up
 * EXMP family (`exmp-fixture.mjs`). A card asks for the width it renders at, so the type draws at size.
 */
import { EXMP_LARGE_TRADES, EXMP_LAST_CLOSE, EXMP_OUTLOOK, EXMP_OUTLOOK_HISTORY, EXMP_PRICE, usd } from "./exmp-fixture.mjs";

const DAY = 86_400_000;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`);

/** "SEP 14" as the tile prints it: "Sep 14". */
export const tileDate = (label) => label.charAt(0) + label.slice(1, 3).toLowerCase() + label.slice(3);

/** A horizon's "SEP 14" as a timestamp: the first such day after the last close. */
function horizonTime(label, afterMs) {
  const [mon, day] = label.split(" ");
  const year = new Date(afterMs).getUTCFullYear();
  const t = Date.UTC(year, MONTHS.indexOf(mon), Number(day));
  return t > afterMs ? t : Date.UTC(year + 1, MONTHS.indexOf(mon), Number(day));
}

/**
 * The analysis card's chart at `width`: the month of closes, a dotted path to the three projected prices
 * on a true-to-time axis (v2.52 ruling 9), and where each horizon tile sits. Each tile is centred under its
 * own point, and its width is capped by the tightest gap between neighbouring points (v2.54 ruling 2).
 */
export function analysisCard(width) {
  const W = width, top = 12, bot = 122, axis = 132;
  const t0 = utc(EXMP_OUTLOOK_HISTORY[0].date);
  const tLast = utc(EXMP_OUTLOOK_HISTORY.at(-1).date);
  const hz = EXMP_OUTLOOK.horizons.map((h) => ({ ...h, d: (horizonTime(h.date, tLast) - t0) / DAY }));
  const span = hz.at(-1).d;
  const X = (d) => 16 + (d / span) * (W - 76);
  const values = [...EXMP_OUTLOOK_HISTORY.map((p) => Number(p.close)), ...hz.map((h) => h.price)];
  const lo = Math.floor((Math.min(...values) - 0.3) * 2) / 2;
  const hi = Math.ceil((Math.max(...values) + 0.3) * 2) / 2;
  const Y = (v) => top + ((hi - v) / (hi - lo)) * (bot - top);
  const hist = EXMP_OUTLOOK_HISTORY.map((p) => [X((utc(p.date) - t0) / DAY), Y(Number(p.close))]);
  const today = hist.at(-1);
  const pts = hz.map((h) => ({ word: h.key.toUpperCase(), date: tileDate(h.date), price: usd(h.price), x: X(h.d), y: Y(h.price) }));
  const gapPct = Math.min(...pts.slice(1).map((p, k) => ((p.x - pts[k].x) / W) * 100));
  const xy = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const spot = usd(EXMP_PRICE);
  const asOf = tileDate(EXMP_LAST_CLOSE);
  const label =
    `EXMP analysis, three projected prices: price ${spot} on ${asOf}; ` +
    pts.map((p) => `${p.word.toLowerCase()}, ${p.date}, ${p.price}`).join("; ") + ".";
  const svg =
    `<svg class="pic-chart" viewBox="0 0 ${W} 150" role="img" aria-label="${label}">` +
    `<line class="pic-chart__axis" x1="0" y1="${axis}" x2="${W}" y2="${axis}"/>` +
    `<polyline class="pic-chart__hist" points="${hist.map(xy).join(" ")}"/>` +
    `<polyline class="pic-chart__proj" points="${[today, ...pts.map((p) => [p.x, p.y])].map(xy).join(" ")}"/>` +
    `<line class="pic-chart__today" x1="${today[0].toFixed(1)}" y1="10" x2="${today[0].toFixed(1)}" y2="${axis}"/>` +
    `<text class="pic-chart__today-label" x="${today[0].toFixed(1)}" y="146" text-anchor="middle">TODAY</text>` +
    pts.map((p) => `<line class="pic-chart__drop" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="150"/>` +
      `<circle class="pic-chart__pt" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5"/>`).join("") +
    `</svg>`;
  return {
    spot,
    asOf,
    svg,
    tileWidth: `min(124px, calc(${gapPct.toFixed(2)}% - 10px))`,
    tiles: pts.map((p) => ({ ...p, pct: ((p.x / W) * 100).toFixed(2) })),
  };
}

/** The Large options trades stat line: the five sessions' premium and the calls and puts shares. */
export function largeTradesSummary(sessions = EXMP_LARGE_TRADES) {
  const calls = sessions.reduce((s, x) => s + x.calls, 0);
  const puts = sessions.reduce((s, x) => s + x.puts, 0);
  const callsPct = Math.round((calls / (calls + puts)) * 100);
  return { total: `$${(calls + puts).toFixed(1)}M`, callsPct, putsPct: 100 - callsPct };
}

/**
 * The five-session chart at `width` (read-components §4l): calls above the line and puts below, each bar's
 * height by the square root of its premium, every bar labelled with its figure, no direction wording.
 */
export function largeTradesSvg(width, sessions = EXMP_LARGE_TRADES) {
  // Below 240 the "calls" and "puts" words sit inside the chart's corners, so the bars get the width.
  const W = width, left = width < 240 ? 0 : 40, maxH = 40, base = 58;
  const step = (W - left) / sessions.length;
  const bw = Math.min(26, step * 0.62);
  const max = Math.sqrt(Math.max(...sessions.flatMap((s) => [s.calls, s.puts])));
  const m = (v) => `$${v.toFixed(1)}M`;
  const label =
    "Premium in large trades by session, calls above the line and puts below: " +
    sessions.map((s) => `${s.label} calls ${m(s.calls)} puts ${m(s.puts)}`).join("; ") + ".";
  const bars = sessions.map((s, k) => {
    const x = left + k * step + (step - bw) / 2, cx = x + bw / 2;
    const ch = (Math.sqrt(s.calls) / max) * maxH, ph = (Math.sqrt(s.puts) / max) * maxH;
    const now = s.label === "today" ? " pic-trades__cap--now" : "";
    return (
      `<rect class="pic-trades__calls" x="${x.toFixed(1)}" y="${(base - 1 - ch).toFixed(1)}" width="${bw.toFixed(1)}" height="${ch.toFixed(1)}" rx="2"/>` +
      `<rect class="pic-trades__puts" x="${x.toFixed(1)}" y="${base + 1}" width="${bw.toFixed(1)}" height="${ph.toFixed(1)}" rx="2"/>` +
      `<text class="pic-trades__fig" x="${cx.toFixed(1)}" y="${(base - 4 - ch).toFixed(1)}" text-anchor="middle">${m(s.calls)}</text>` +
      `<text class="pic-trades__fig" x="${cx.toFixed(1)}" y="${(base + 11 + ph).toFixed(1)}" text-anchor="middle">${m(s.puts)}</text>` +
      `<text class="pic-trades__cap${now}" x="${cx.toFixed(1)}" y="122" text-anchor="middle">${s.label}</text>`
    );
  });
  return (
    `<svg class="pic-trades" viewBox="0 0 ${W} 124" role="img" aria-label="${label}">` +
    `<line class="pic-trades__axis" x1="0" y1="${base}" x2="${W}" y2="${base}"/>` +
    `<text class="pic-trades__side" x="0" y="10">calls</text><text class="pic-trades__side" x="0" y="108">puts</text>` +
    bars.join("") +
    `</svg>`
  );
}
