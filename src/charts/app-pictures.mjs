/**
 * The Portfolio/Position product pictures' two charts, for the explainer's page 2
 * (stock-analyst-platform#3829; ADR 0993: "every product picture is the signed Portfolio/Position
 * artifact's own CSS and drawing code, scoped under .app").
 *
 * Ported from `ai-team/design/assets/portfolio-position-analysis-2026-09-20.html`'s own `payoff()` and
 * `distanceChart()`, as the explainer build reference uses them — with the one change its notes
 * record: "the payoff chart's three gridline values are now inputs, because the artifact hard-coded
 * NVDA's +$4,000 / −$2,000 scale." The drawing is kept to the artifact's markup, colours bound by the
 * `.app` scope's variables (styles/explainer.css), so the picture is the signed product's.
 *
 * Every figure the charts carry comes from `coveredCallMath()` (exmp-fixture.mjs); the chart configs
 * below set only the frame (domain, range, gridlines), which is presentation, not data.
 */
import { COVERED_CALL, COVERED_CALL_RULES, coveredCallMath } from "./exmp-fixture.mjs";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);
const money0 = (v) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US")}`;

/**
 * @param {{ dom: [number, number], rng: [number, number], pts: Array<[number, number]>, be: number,
 *   grid: [number, number], last?: number, cap?: { p: number, v: number, label: string }, aria: string }} cfg
 *   `grid` is the upper and lower gridline values; the $0 line is always drawn.
 */
export function payoffSvg(cfg) {
  const x0 = 44, x1 = 326, yT = 16, yB = 152;
  const [pLo, pHi] = cfg.dom;
  const [vLo, vHi] = cfg.rng;
  const px = (p) => x0 + ((p - pLo) / (pHi - pLo)) * (x1 - x0);
  const py = (v) => yB - ((v - vLo) / (vHi - vLo)) * (yB - yT);
  let d = `M ${px(cfg.pts[0][0]).toFixed(1)} ${py(cfg.pts[0][1]).toFixed(1)}`;
  for (let i = 1; i < cfg.pts.length; i++) d += ` L ${px(cfg.pts[i][0]).toFixed(1)} ${py(cfg.pts[i][1]).toFixed(1)}`;
  const xBE = px(cfg.be);
  const y0 = py(0);
  const [gHi, gLo] = cfg.grid;
  let s = `<svg class="g" viewBox="0 0 340 194" role="img" aria-label="${esc(cfg.aria)}">`;
  s += '<defs><pattern id="hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--neg)" opacity="0.07"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--neg)" stroke-width="1.6" opacity="0.3"/></pattern></defs>';
  s += `<rect x="${x0}" y="${yT}" width="${(xBE - x0).toFixed(1)}" height="${yB - yT}" fill="url(#hx)"/>`;
  s += `<rect x="${xBE.toFixed(1)}" y="${yT}" width="${(x1 - xBE).toFixed(1)}" height="${yB - yT}" fill="var(--pos)" opacity="0.09"/>`;
  for (const v of [gHi, gLo]) {
    if (v > vLo && v < vHi) s += `<line x1="${x0}" y1="${py(v).toFixed(1)}" x2="${x1}" y2="${py(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`;
  }
  s += `<line x1="${x0}" y1="${y0.toFixed(1)}" x2="${x1}" y2="${y0.toFixed(1)}" stroke="var(--line-strong)" stroke-width="1.4"/>`;
  s += `<text x="${x0 - 6}" y="${(py(gHi) + 3.5).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="8.5" fill="var(--muted)">${money0(gHi)}</text>`;
  s += `<text x="${x0 - 6}" y="${(y0 + 3.5).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="8.5" fill="var(--muted)">$0</text>`;
  s += `<text x="${x0 - 6}" y="${(py(gLo) + 3.5).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="8.5" fill="var(--muted)">${money0(gLo)}</text>`;
  s += `<text x="${x0 + 5}" y="26" font-family="var(--sans)" font-size="8.5" fill="var(--neg)">loss at expiry</text>`;
  s += `<text x="${(xBE + 7).toFixed(1)}" y="26" font-family="var(--sans)" font-size="8.5" fill="var(--pos)">profit at expiry</text>`;
  s += `<line x1="${xBE.toFixed(1)}" y1="${yT}" x2="${xBE.toFixed(1)}" y2="${yB}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
  if (cfg.last != null) s += `<line x1="${px(cfg.last).toFixed(1)}" y1="${yT}" x2="${px(cfg.last).toFixed(1)}" y2="${yB}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="1 5"/>`;
  s += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="miter"/>`;
  s += `<circle cx="${xBE.toFixed(1)}" cy="${y0.toFixed(1)}" r="3.4" fill="var(--canvas)" stroke="var(--ink)" stroke-width="1.5"/>`;
  s += `<text x="${xBE.toFixed(1)}" y="11" text-anchor="middle" font-family="var(--sans)" font-size="8.5" fill="var(--muted)">breakeven</text>`;
  if (cfg.cap) {
    const cx = px(cfg.cap.p), cy = py(cfg.cap.v);
    s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.4" fill="var(--ink)"/>`;
    s += `<text x="${(cx - 7).toFixed(1)}" y="${(cy + 13).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="10" font-weight="600" fill="var(--ink)" stroke="var(--canvas)" stroke-width="2.6" paint-order="stroke">${esc(cfg.cap.label)}</text>`;
    s += `<line x1="${cx.toFixed(1)}" y1="${yB}" x2="${cx.toFixed(1)}" y2="${yB + 4}" stroke="var(--ink)" stroke-width="1"/>`;
    s += `<text x="${cx.toFixed(1)}" y="${yB + 15}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--ink)">$${cfg.cap.p.toFixed(2)}</text>`;
  }
  s += `<line x1="${xBE.toFixed(1)}" y1="${yB}" x2="${xBE.toFixed(1)}" y2="${yB + 4}" stroke="var(--muted)" stroke-width="1"/>`;
  s += `<text x="${xBE.toFixed(1)}" y="${yB + 15}" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="var(--muted)">$${cfg.be.toFixed(2)}</text>`;
  return `${s}</svg>`;
}

/**
 * "Distance to your rules" — one bar per rule, from where it stood at open (left) to where it fires
 * (right). `rows[i].rule` = { t: state word, v: the reading, f: 0–1 distance, s: reached|approach|notmet, mk }.
 */
export function rulesChartSvg(rows, xLab = 62) {
  const n = rows.length, rowH = 20, top = 14, W = 340, xEnd = 286, H = top + n * rowH + 4;
  let s = `<svg class="g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distance to your rules. ${rows.map((r) => `${esc(r.label)}, ${esc(r.rule.t)} at ${esc(r.rule.v)}`).join(". ")}.">`;
  s += `<text x="${xLab}" y="7" font-family="var(--sans)" font-size="7" fill="var(--muted)">0</text>`;
  s += `<text x="${xEnd}" y="7" text-anchor="end" font-family="var(--sans)" font-size="7" fill="var(--muted)">fires</text>`;
  s += `<line x1="${xEnd}" y1="10" x2="${xEnd}" y2="${top + n * rowH - 6}" stroke="var(--line-strong)" stroke-width="1"/>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH + 7;
    const f = Math.max(0, Math.min(1, r.rule.f));
    const xm = xLab + f * (xEnd - xLab);
    const met = r.rule.s === "reached";
    const ink = met ? "var(--ink)" : r.rule.s === "approach" ? "var(--secondary)" : "var(--muted)";
    s += `<text x="0" y="${y + 3}" font-family="var(--mono)" font-size="8" fill="${ink}"${met ? ' font-weight="600"' : ""}>${esc(r.rule.mk)}  ${esc(r.label)}</text>`;
    s += `<line x1="${xLab}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="var(--line)" stroke-width="4"/>`;
    if (f > 0.01) s += `<line x1="${xLab}" y1="${y}" x2="${xm.toFixed(1)}" y2="${y}" stroke="var(--secondary)" stroke-width="4" opacity="0.4"/>`;
    s += `<line x1="${xm.toFixed(1)}" y1="${y - 5}" x2="${xm.toFixed(1)}" y2="${y + 5}" stroke="var(--ink)" stroke-width="1.8"/>`;
    const right = f > 0.55;
    const word = r.rule.s === "notmet" ? "" : `${esc(r.rule.t)} `;
    s += `<text x="${(right ? xm - 4 : xm + 4).toFixed(1)}" y="${y - 6.5}" text-anchor="${right ? "end" : "start"}" font-family="var(--sans)" font-size="7.5" fill="var(--muted)">${word}<tspan font-family="var(--mono)" fill="${ink}">${esc(r.rule.v)}</tspan></text>`;
  });
  return `${s}</svg>`;
}

const cc = coveredCallMath();

/** The covered call's payoff, as page 2 draws it: every figure from `pnlAt`, the frame chosen. */
export const COVERED_CALL_PAYOFF = {
  dom: [38, 54],
  rng: [-1600, 3100],
  grid: [2000, -1000],
  pts: [38, COVERED_CALL.strike, 54].map((p) => [p, cc.pnlAt(p)]),
  be: cc.breakeven,
  last: COVERED_CALL.shareMark,
  cap: { p: COVERED_CALL.strike, v: cc.maxProfit, label: money0(cc.maxProfit) },
  aria: `Payoff at expiry for your covered call. Maximum profit ${money0(cc.maxProfit).slice(1)} at $${COVERED_CALL.strike.toFixed(2)} and above. Breakeven $${cc.breakeven.toFixed(2)}. Maximum loss ${money0(cc.maxLoss).slice(1)} if ${COVERED_CALL.ticker} reaches $0.00.`,
};

/**
 * The covered call's rules as the chart draws them. Each bar's distance is computed from the rule's
 * own reading: an option target by credit captured over its target, expiry by the threshold over the
 * days left, a stock target by return over target, a max loss by loss over its limit (0 while up).
 */
const STATE = { reached: ["reached", "●", "reached"], approaching: ["approach", "◐", "approaching"], "not-met": ["notmet", "○", "not met"] };
const [opt, exp, stk, loss] = COVERED_CALL_RULES;
const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(v % 1 === 0 ? 0 : 1)}%`;
const rule = (r, v, f) => ({ s: STATE[r.state][0], mk: STATE[r.state][1], t: STATE[r.state][2], v, f });
export const COVERED_CALL_RULE_ROWS = [
  { label: "Option target 60% · call", rule: rule(opt, pct(Math.round(opt.value)), opt.value / opt.threshold) },
  { label: "Expiry 21 · call", rule: rule(exp, `${exp.value} DTE`, exp.threshold / exp.value) },
  { label: "Stock target 25% · sh", rule: rule(stk, pct(Number(stk.value.toFixed(1))), stk.value / stk.threshold) },
  { label: "Stock max loss −15% · sh", rule: rule(loss, pct(Math.max(0, -loss.value)), Math.max(0, -loss.value) / 15) },
];
