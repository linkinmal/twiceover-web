/**
 * The drawings behind the hero deck's cards 1 and 5–7 (stock-analyst-platform#4411; site-prelaunch.md v2.51
 * §2 "Hero deck"; build reference `hero-deck-8-cards-4410-2026-10-18.html`, which is what was signed
 * off and what the numbers below were measured from). v2.52 (#4410, #4422) redrew card 1 (the deck's
 * own Outlook) and card 7 (Insiders) from `hero-deck-cards-v5-4410-2026-10-18.html`.
 *
 * String builders, like `outlook-svg.mjs` beside it, so each drawing is a module this repo can test
 * in isolation. Every figure comes from the page's one fixture (`site-fixture.mjs`); the only numbers
 * typed here are the drawing's own geometry (scales, offsets, label positions).
 *
 * **Two drawings per card, one per width.** Each builder takes `phone` and returns a whole `<svg>`:
 * the phone twin draws at true size (type 10–12.5px, heavier marks, fewer labels) rather than being
 * the desktop one scaled down. CSS swaps them with a container query on `.deck` below 400px
 * (`svg.hc--desk` hides, `svg.hc--phone` shows).
 *
 * Both twins carry the same `role="img"` and label: below 400px the desktop twin is `display:none`, so
 * it is out of the accessibility tree, and only one twin renders at a time (nothing reads twice).
 *
 * Colour comes from `--muted`, `--text`, `--bmark` and the other short names, which `.hc` binds to the
 * site's tokens in `site.css`; the markup is otherwise the artifact's.
 *
 * Card 8 draws the Macro board's tiles, built in `macro-board-svg.mjs`.
 */
import { projectionChartModel } from "./outlook-chart.mjs";
import {
  DECK_CLOSE_ISO,
  EARNINGS_HISTORY,
  HERO_OUTLOOK,
  HORIZON_CARDS,
  INSIDERS,
  INSIDER_FIGURES,
  OPTIONS_CARD,
  OUTLOOK_HISTORY,
  SPOT,
  money as usd,
} from "./site-fixture.mjs";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Computed coordinates print to one decimal, like the artifact. */
const f = (v) => v.toFixed(1);
const f2 = (v) => Number(v.toFixed(2));

const DAY_MS = 86_400_000;
const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const monthDay = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const money = (usd) => `$${Math.abs(usd).toFixed(1)}M`;

const svgOpen = (phone, label, w, h) =>
  `<svg class="hc ${phone ? "hc--phone" : "hc--desk"}" viewBox="0 0 ${w} ${h}" ${
    label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`
  } xmlns="http://www.w3.org/2000/svg">`;

const text = (x, y, anchor, size, fill, body, { family = "var(--mono)", weight } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${family}" font-size="${size}"${
    weight ? ` font-weight="${weight}"` : ""
  } fill="${fill}">${esc(body)}</text>`;

/* ── Card 5: the expected-move cone ─────────────────────────────────────────────────────────────── */

/**
 * x by calendar days from the last close, y by percent, a √t curve through the three horizon points:
 * √days is piecewise-linear between (0, 0) and each horizon's (√days, pct).
 */
export function coneHalfWidthPct(horizons, d) {
  const pts = [{ root: 0, pct: 0 }, ...horizons.map((h) => ({ root: Math.sqrt(h.days), pct: h.pct }))];
  const root = Math.sqrt(d);
  for (let i = 1; i < pts.length; i++) {
    if (root <= pts[i].root || i === pts.length - 1) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.pct + ((b.pct - a.pct) * (root - a.root)) / (b.root - a.root);
    }
  }
  return 0;
}

const CONE = {
  desk: {
    w: 440, h: 226, left: 12, right: 428, x0: 104, xFar: 408, yc: 104, pxPerPct: 2.3, histLeft: 16,
    vTop: 22, vBottom: 192, cap: 4, wMark: 1.6, whisker: 8,
    pctSize: 13, pctWeight: 700, tickY: 205, dateY: 218, tickSize: 10.5, dateSize: 9.5,
    tagX: 30, tagW: 60, dot: 4, report: { y2: 186, diamond: 9, labelDx: -10, labelY: 193, size: 10 },
    anchors: { near: ["middle", "start", 0, -3], mid: ["middle", "middle", 0, 0], far: ["end", "end", 4, 0] },
    today: true,
  },
  phone: {
    w: 300, h: 164, left: 4, right: 296, x0: 58, xFar: 286, yc: 70, pxPerPct: 1.4, histLeft: 8,
    vTop: 20, vBottom: 128, cap: 3.5, wMark: 1.6, whisker: 7,
    pctSize: 12.5, pctWeight: 700, tickY: 147, dateY: 160, tickSize: 11, dateSize: 10,
    tagX: 28, tagW: 56, dot: 3.5, report: { y2: 126, diamond: 8, labelDx: -9, labelY: 134, size: 10.5 },
    anchors: { near: ["start", "start", -4, -4], mid: ["middle", "middle", 0, 0], far: ["end", "end", 3, 3] },
    today: false,
  },
};

/** Card 5's chart: a month of closes into today, then the range options price in to each horizon. */
export function coneSvg({ phone = false } = {}) {
  const g = CONE[phone ? "phone" : "desk"];
  const horizons = OPTIONS_CARD.horizons.map((h) => ({ ...h, days: days(DECK_CLOSE_ISO, h.landing) }));
  const far = horizons[horizons.length - 1].days;
  const pxPerDay = (g.xFar - g.x0) / far;
  const X = (d) => g.x0 + d * pxPerDay;
  const Y = (pct) => g.yc - pct * g.pxPerPct;
  const reportDays = days(DECK_CLOSE_ISO, OPTIONS_CARD.report.date);

  const label = `Price over the last month into today at $${SPOT.toFixed(2)}, then the range options price in to each horizon: ${horizons
    .map((h, i) => `${["Near", "Mid", "Far"][i]}, plus or minus ${h.pct.toFixed(1)}% through ${monthDay(h.landing).replace(/^(\w)(\w+)/, (_, a, b) => a + b.toLowerCase())}`)
    .join("; ")}. The ${OPTIONS_CARD.report.label.replace("report ", "")} report falls inside the Mid range.`;

  // The cone: every 3 days out to the last whole step inside the far horizon, mirrored below.
  const upper = [[g.x0, g.yc]];
  const lower = [[g.x0, g.yc]];
  for (let d = 3; d <= far - 2; d += 3) {
    const w = coneHalfWidthPct(horizons, d) * g.pxPerPct;
    upper.push([X(d), g.yc - w]);
    lower.push([X(d), g.yc + w]);
  }
  const pts = (arr) => arr.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  const out = [svgOpen(phone, label, g.w, g.h)];
  out.push(
    `<polygon points="${pts(upper)} ${pts([...lower].reverse())}" fill="var(--bmark)" fill-opacity=".13" stroke="var(--bmark)" stroke-width="1.3" stroke-linejoin="round"/>`,
    `<line x1="${g.left}" y1="${f(g.yc)}" x2="${g.right}" y2="${f(g.yc)}" stroke="var(--muted)" stroke-dasharray="1 4"/>`,
    `<line x1="${f(g.x0)}" y1="${g.vTop}" x2="${f(g.x0)}" y2="${g.vBottom}" stroke="var(--muted)" stroke-dasharray="2 3"/>`,
  );
  // One whisker per horizon: the range as a bar, its figure above, the window and date beneath.
  horizons.forEach((h) => {
    const x = X(h.days);
    const [pctAnchor, tickAnchor, pctDx, tickDx] = g.anchors[h.key];
    const top = Y(h.pct);
    const bottom = g.yc + h.pct * g.pxPerPct;
    out.push(
      `<line x1="${f(x)}" y1="${f(top)}" x2="${f(x)}" y2="${f(bottom)}" stroke="var(--bmark)" stroke-width="${g.wMark}"/>`,
      `<line x1="${f(x - g.cap)}" y1="${f(top)}" x2="${f(x + g.cap)}" y2="${f(top)}" stroke="var(--bmark)" stroke-width="${g.wMark}"/>`,
      `<line x1="${f(x - g.cap)}" y1="${f(bottom)}" x2="${f(x + g.cap)}" y2="${f(bottom)}" stroke="var(--bmark)" stroke-width="${g.wMark}"/>`,
      text(x + pctDx, top - g.whisker, pctAnchor, g.pctSize, "var(--bmark)", `±${h.pct.toFixed(1)}%`, { weight: g.pctWeight }),
      text(x + tickDx, g.tickY, tickAnchor, g.tickSize, "var(--bmark)", h.tick, { weight: 600 }),
      text(x + tickDx, g.dateY, tickAnchor, g.dateSize, "var(--muted)", monthDay(h.landing)),
    );
  });

  // The month of closes into today, on the same y scale as the cone.
  const hist = OUTLOOK_HISTORY.map((s) => {
    const back = days(s.date, DECK_CLOSE_ISO);
    return [g.x0 - (back * (g.x0 - g.histLeft)) / days(OUTLOOK_HISTORY[0].date, DECK_CLOSE_ISO), g.yc + ((SPOT - Number(s.close)) / SPOT) * 100 * g.pxPerPct];
  });
  out.push(
    `<polyline points="${pts(hist)}" fill="none" stroke="var(--text)" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<circle cx="${f(g.x0)}" cy="${f(g.yc)}" r="${g.dot}" fill="var(--text)"/>`,
    `<rect x="${f(g.x0 - g.tagX)}" y="1" width="${g.tagW}" height="17" rx="2" fill="var(--accent)"/>`,
    text(g.x0, 13, "middle", 11, "var(--color-text-on-accent)", `$${SPOT.toFixed(2)}`, { weight: 700 }),
  );
  if (g.today) {
    out.push(
      text(g.x0 + 3, g.tickY, "end", g.tickSize, "var(--text)", "TODAY", { weight: 700 }),
      text(g.x0 + 3, g.dateY, "end", g.dateSize, "var(--muted)", monthDay(DECK_CLOSE_ISO)),
      text(g.histLeft, g.dateY, "start", g.dateSize, "var(--muted)", monthDay(OUTLOOK_HISTORY[0].date)),
    );
  }

  // The report, marked on the axis and tied up to the cone's lower edge.
  const rx = X(reportDays);
  const edge = g.yc + coneHalfWidthPct(horizons, reportDays) * g.pxPerPct;
  const r = g.report;
  out.push(
    `<line x1="${f(rx)}" y1="${f(edge)}" x2="${f(rx)}" y2="${r.y2}" stroke="var(--text)" stroke-dasharray="1 2" opacity=".6"/>`,
    `<rect x="${f(rx - r.diamond / 2)}" y="${r.y2 - (phone ? 0 : 1)}" width="${r.diamond}" height="${r.diamond}" transform="rotate(45 ${f(rx)} ${f(r.y2 + (phone ? 4 : 3.5))})" fill="var(--text)"/>`,
    text(rx + r.labelDx, r.labelY, "end", r.size, "var(--text)", OPTIONS_CARD.report.label, { weight: 600 }),
    `</svg>`,
  );
  return out.join("");
}

/** The five-session skew line under card 5's Skew row (62×16). */
export function skewSparkSvg() {
  const s = OPTIONS_CARD.skew.fiveSession;
  const lo = Math.min(...s);
  const hi = Math.max(...s);
  const pts = s.map((v, i) => [2 + i * 14, 12.5 - ((v - lo) / (hi - lo)) * 9]);
  const last = pts[pts.length - 1];
  return (
    `<svg class="spark" viewBox="0 0 62 16" width="62" height="16" aria-hidden="true">` +
    `<polyline points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="none" stroke="var(--muted)" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<circle cx="${f(last[0])}" cy="${f(last[1])}" r="2.4" fill="var(--text)"/></svg>`
  );
}

/* ── Card 6: eight reports, implied against moved ──────────────────────────────────────────────── */

const EH = {
  desk: { w: 440, h: 220, x0: 34, x1: 434, zero: 104, perPct: 9.2, top: 12, bottom: 196, barW: 23, circle: 4.5, ring: 1, labelY: 214 },
  phone: { w: 300, h: 176, x0: 34, x1: 296, zero: 74, perPct: 6.2, top: 12, bottom: 136, barW: 18, circle: 4.5, ring: 1.2, labelY: 157 },
};

export function earningsSvg({ phone = false } = {}) {
  const g = EH[phone ? "phone" : "desk"];
  const c = phone ? f : f2;
  const pitch = (g.x1 - g.x0) / EARNINGS_HISTORY.length;
  const movedMore = EARNINGS_HISTORY.filter((r) => Math.abs(r.moved) > r.implied).length;
  const label = `The last eight reports, oldest first: what options implied against how the stock moved. It moved more than implied ${movedMore === 2 ? "twice" : `${movedMore} times`}.`;
  const out = [svgOpen(phone, label, g.w, g.h)];
  const axis = (y, name, strong) => {
    const yy = phone && strong ? g.zero.toFixed(1) : y;
    out.push(
      `<line x1="${phone ? "34.0" : g.x0}" y1="${yy}" x2="${g.x1}" y2="${yy}" stroke="var(${strong ? "--border-strong" : "--border"})"/>`,
      text(29, y + 3.5, "end", 10, "var(--muted)", name),
    );
  };
  axis(g.top, "+10%", false);
  axis(g.zero, "0", true);
  axis(g.bottom, "−10%", false);
  EARNINGS_HISTORY.forEach((r, i) => {
    const cx = g.x0 + pitch * (i + 0.5);
    const half = r.implied * g.perPct;
    const cy = g.zero - r.moved * g.perPct;
    out.push(
      `<rect x="${f(cx - g.barW / 2)}" y="${c(g.zero - half)}" width="${g.barW}" height="${c(half * 2)}" rx="2" fill="var(--faint)" fill-opacity=".28" stroke="var(--muted)" stroke-width=".9"/>`,
      `<circle cx="${f(cx)}" cy="${c(cy)}" r="${g.circle}" fill="var(--text)"/>`,
    );
    if (Math.abs(r.moved) > r.implied) {
      out.push(`<circle cx="${f(cx)}" cy="${c(cy)}" r="8" fill="none" stroke="var(--text)"${g.ring !== 1 ? ` stroke-width="${g.ring}"` : ""}/>`);
    }
    // The year shows on the first report and wherever it turns over.
    const showYear = i === 0 || r.year !== EARNINGS_HISTORY[i - 1].year;
    if (phone) {
      out.push(text(cx, g.labelY, "middle", 11, "var(--muted)", r.month, { family: "var(--font-family-sans)" }));
      if (showYear) out.push(text(cx, 171, "middle", 10, "var(--muted)", r.year));
    } else {
      out.push(text(cx, g.labelY, "middle", 10, "var(--muted)", showYear ? `${r.month} ${r.year}` : r.month));
    }
  });
  out.push(`</svg>`);
  return out.join("");
}

/* ── Card 7: the insider timeline ──────────────────────────────────────────────────────────────── */

const INS = {
  desk: { w: 420, h: 118, x0: 12, x1: 408, axis: 30, mar1: 20.12, pxPerDay: 2.1216, tall: 54, bar: 9, tickY: 110, size: 10.5, tick: 3 },
  phone: { w: 280, h: 88, x0: 6, x1: 274, axis: 10, mar1: 13.41, pxPerDay: 1.4145, tall: 56, bar: 8, tickY: 83, size: 10, tick: 3 },
};

/** Sells hang below the line, buys stand above it; height is √dollars, the largest sell the tallest. */
export function insidersSvg({ phone = false } = {}) {
  const g = INS[phone ? "phone" : "desk"];
  const mar1 = `${INSIDERS.from.slice(0, 4)}-03-01`;
  const X = (iso) => g.mar1 + days(mar1, iso) * g.pxPerDay;
  const maxSell = Math.max(...INSIDERS.sells.map((s) => s.usd));
  const H = (usd) => g.tall * Math.sqrt(usd / maxSell);
  const largest = INSIDER_FIGURES.largest;
  const buy = INSIDERS.buys[0];
  const month = (m) => ["Mar", "Apr", "May", "Jun", "Jul", "Aug"][m];
  const label = `Officer and director trades from Feb 28 to Aug 28: ${INSIDERS.sells.length} sells and ${INSIDERS.buys.length} buy. Sells hang below the line, the buy stands above, height is dollar value. ${INSIDER_FIGURES.underPlan.replace(" of", " of the")} were under a 10b5-1 plan. The largest, the ${largest.title} on ${monthDay(largest.date).replace(/^(\w)(\w+)/, (_, a, b) => a + b.toLowerCase())}, was minus ${largest.usd} million dollars; the one buy, a ${buy.title.toLowerCase()}, plus ${buy.usd} million.`;
  // Two decimals, like the v2.52 artifact (the other drawings print one).
  const t = (x, y, anchor, body) =>
    `<text x="${f2(x)}" y="${f2(y)}" text-anchor="${anchor}" font-family="var(--font-family-sans)" font-size="${g.size}" font-weight="600" fill="var(--text)">${esc(body)}</text>`;
  const out = [svgOpen(phone, label, g.w, g.h)];
  out.push(`<line x1="${g.x0}" y1="${g.axis}" x2="${g.x1}" y2="${g.axis}" stroke="var(--border-strong)" stroke-width="1.2"/>`);
  for (let m = 0; m < 6; m++) {
    const x = X(`${INSIDERS.from.slice(0, 4)}-${String(m + 3).padStart(2, "0")}-01`);
    out.push(
      `<line x1="${f2(x)}" y1="${g.axis - g.tick}" x2="${f2(x)}" y2="${g.axis + g.tick}" stroke="var(--border-strong)"/>`,
      `<text x="${f2(x)}" y="${g.tickY}" text-anchor="middle" font-family="var(--font-family-sans)" font-size="${g.size}" fill="var(--muted)">${month(m)}</text>`,
    );
  }
  for (const s of INSIDERS.sells) {
    const fill = s.plan ? `fill="var(--muted)" fill-opacity=".75"` : `fill="var(--text)"`;
    out.push(`<rect x="${f2(X(s.date) - g.bar / 2)}" y="${g.axis + 1}" width="${g.bar}" height="${f2(H(s.usd))}" rx="1" ${fill}/>`);
  }
  const bx = X(buy.date) - g.bar / 2;
  const bh = H(buy.usd);
  out.push(`<rect x="${f2(bx)}" y="${f2(g.axis - bh)}" width="${g.bar}" height="${f2(bh)}" rx="1" fill="var(--text)"/>`);
  // The two value labels are the desktop twin's; a phone-width card has no room for them.
  if (!phone) {
    out.push(
      t(bx + g.bar / 2, g.axis - bh - 5, "middle", `${buy.title} +${money(buy.usd)}`),
      t(X(largest.date) - g.bar / 2 - 5, g.axis + H(largest.usd) - 1, "end", `${largest.title} −${money(largest.usd)}`),
    );
  }
  out.push(`</svg>`);
  return out.join("");
}

/* ── Card 1: the deck's own Outlook (v2.52 ruling 9) ────────────────────────────────────────────── */

/**
 * The hero Outlook chart at the deck's size, with each horizon's price in a tile under its own point.
 * The scale math is `projectionChartModel`'s; only the frame and the tile row are the deck's. Two
 * twins, swapped by a container query at 360px of band width (`k-dk` / `k-dp`, site.css).
 */
const OUTLOOK_DECK = {
  desk: { cls: "k-dk", frame: { width: 440, height: 412, padLeft: 8, padRight: 8, padTop: 34, padBottom: 112, insetLeft: 20, insetRight: 48 }, r: 5, tile: { w: 104, h: 64, k: [21.76, 10.5], v: [51.2, 26] } },
  phone: { cls: "k-dp", frame: { width: 300, height: 322, padLeft: 8, padRight: 8, padTop: 34, padBottom: 100, insetLeft: 10, insetRight: 36 }, r: 4, tile: { w: 74, h: 52, k: [17.68, 9], v: [41.6, 19] } },
};

export function outlookDeckSvg({ phone = false } = {}) {
  const g = OUTLOOK_DECK[phone ? "phone" : "desk"];
  const m = projectionChartModel({ ...HERO_OUTLOOK, history: OUTLOOK_HISTORY, compact: phone, frame: g.frame });
  // The value scale ends 6px above the chrome's baseline, and the today rule starts 8px above the scale.
  const bottom = g.frame.height - g.frame.padBottom + 6;
  const cards = Object.fromEntries(HORIZON_CARDS.map((c) => [c.key, c.label]));
  const priceOf = (key) => HERO_OUTLOOK.horizons.find((h) => h.horizon === key).price;
  const words = m.points.map((p) => {
    const [k, d] = cards[p.key].split(" · ");
    return `${k.toLowerCase()} ${d.toLowerCase()} ${usd(priceOf(p.key))}`;
  });
  const label = `Recent daily closes leading into today, then the projection path across the three horizons, each point labelled with its projected price. Shape follows time. ${words.join(". ")}.`;
  const out = [
    `<svg class="k-chart ${g.cls}" viewBox="0 0 ${g.frame.width} ${g.frame.height}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">`,
    `<line class="k-spotline" x1="${m.padLeft}" y1="${f2(m.spotLine.y)}" x2="${m.width - m.padRight}" y2="${f2(m.spotLine.y)}"/>`,
    `<line class="k-today" x1="${f2(m.origin.x)}" y1="${m.padTop - 8}" x2="${f2(m.origin.x)}" y2="${bottom}"/>`,
    `<text class="k-tick" x="${f2(m.origin.x)}" y="11" text-anchor="middle">${esc(m.origin.axisLabel.tick)}</text>`,
    `<text class="k-sub" x="${f2(m.origin.x)}" y="23" text-anchor="middle">${esc(m.origin.axisLabel.sub)}</text>`,
    `<polyline class="k-hist" points="${m.history.points.map((p) => `${f2(p.x)},${f2(p.y)}`).join(" ")}"/>`,
    `<line class="k-conn" x1="${f2(m.history.connector.from.x)}" y1="${f2(m.history.connector.from.y)}" x2="${f2(m.history.connector.to.x)}" y2="${f2(m.history.connector.to.y)}"/>`,
    `<text class="k-hist-date" x="${f2(m.history.startLabel.x)}" y="${bottom + 20}" text-anchor="middle">${esc(m.history.startLabel.text)}</text>`,
    ...m.segments.map((sg) => `<line class="k-seg" x1="${f2(sg.from.x)}" y1="${f2(sg.from.y)}" x2="${f2(sg.to.x)}" y2="${f2(sg.to.y)}"/>`),
    `<circle class="k-origin" cx="${f2(m.origin.x)}" cy="${f2(m.origin.y)}" r="${g.r}"/>`,
  ];
  const dy = phone ? 7 : 8;
  for (const p of m.points) {
    const tileY = bottom + 38;
    out.push(
      `<line class="k-lead" x1="${f2(p.x)}" y1="${f2(p.y + dy)}" x2="${f2(p.x)}" y2="${bottom - 3}"/>`,
      `<line class="k-lead" x1="${f2(p.x)}" y1="${bottom + 26}" x2="${f2(p.x)}" y2="${tileY}"/>`,
      `<circle class="k-point" cx="${f2(p.x)}" cy="${f2(p.y)}" r="${g.r}"/>`,
      `<text class="k-tick" x="${f2(p.x)}" y="${bottom + 8}" text-anchor="middle">${esc(p.axisLabel.tick)}</text>`,
      `<text class="k-sub" x="${f2(p.x)}" y="${bottom + 20}" text-anchor="middle">${esc(p.axisLabel.sub)}</text>`,
      `<rect class="k-tile" x="${f2(p.x - g.tile.w / 2)}" y="${tileY}" width="${g.tile.w}" height="${g.tile.h}" rx="7"/>`,
      `<text class="k-hzk" x="${f2(p.x)}" y="${f2(tileY + g.tile.k[0])}" text-anchor="middle" style="font-size:${g.tile.k[1]}px">${p.key.toUpperCase()}</text>`,
      `<text class="k-hzv" x="${f2(p.x)}" y="${f2(tileY + g.tile.v[0])}" text-anchor="middle" style="font-size:${g.tile.v[1]}px">${usd(priceOf(p.key))}</text>`,
      `<circle class="k-hit" cx="${f2(p.x)}" cy="${f2(p.y)}" r="14"><title>${esc(cards[p.key])} — Our projection points to ${usd(priceOf(p.key))}</title></circle>`,
    );
  }
  out.push(`</svg>`);
  return out.join("");
}
