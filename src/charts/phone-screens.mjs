// The three app screens the site's neutral phone shows (app-launch-surfaces.md §1–§3, Phone board):
// Your Portfolio, one position, an analysis. Every figure comes out of `site-fixture.mjs`, the same book
// and the same NVDA read the hero deck and the explainers draw, so a phone cannot disagree with them.
// Geometry is computed here, not traced from the board's sketch, so the points move with the numbers;
// each plot's scale is fixed, and phone-screens.test.mjs fails a point that falls outside its plot.
import {
  AS_OF,
  AS_OF_CLOCK,
  COMPANY_NAME,
  HERO_OUTLOOK,
  HORIZON_CARDS,
  NVDA_OPTION_TARGET_PCT,
  OUTLOOK_HISTORY,
  PORTFOLIO,
  SPOT,
  SPREAD,
  money,
  signedMoney,
  signedPct,
  spreadPnlAt,
} from "./site-fixture.mjs";

const round = (v) => Number(v.toFixed(1));

/** `Aug 31`, the analysis stamp's date, from the fixture's own as-of instant: the ET date, so it agrees with the ET clock. */
function stampDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

/** One position: the NVDA spread against its option target, with its payoff at expiry. */
export function positionScreen() {
  const row = PORTFOLIO.rows.find((r) => r.ticker === "NVDA");
  const maxLoss = spreadPnlAt(SPREAD.lowerStrike);
  const maxGain = spreadPnlAt(SPREAD.upperStrike);
  // The payoff in a 256×86 plot: the strikes at x 66 and 190, $0 on y 50, $3,000 per 60 units.
  const x = (price) => round(66 + ((price - SPREAD.lowerStrike) * 124) / (SPREAD.upperStrike - SPREAD.lowerStrike));
  const y = (pnl) => round(50 - pnl * 0.02);
  const [x0, x1] = [8, 248];
  const priceAt = (px) => SPREAD.lowerStrike + ((px - 66) * (SPREAD.upperStrike - SPREAD.lowerStrike)) / 124;
  const payoff = [x0, x(SPREAD.lowerStrike), x(SPREAD.upperStrike), x1]
    .map((px) => `${px},${y(spreadPnlAt(priceAt(px)))}`)
    .join(" ");
  return {
    title: `${row.ticker} ${row.structure}`,
    legs: `${SPREAD.contracts} contracts · ${SPREAD.lowerStrike}/${SPREAD.upperStrike} calls · ${SPREAD.expiry}`,
    pnl: signedMoney(row.pnl),
    pnlOfDebit: `${signedPct(row.pct)} of the ${signedMoney(SPREAD.netDebit).slice(1)} debit`,
    rule: row.rule,
    meterPct: round((row.pct / NVDA_OPTION_TARGET_PCT) * 100),
    meterNow: `${row.pct.toFixed(1)}%`,
    meterTarget: `your ${NVDA_OPTION_TARGET_PCT}%`,
    payoff,
    zeroY: y(0),
    spot: { x: x(SPOT), y: y(spreadPnlAt(SPOT)) },
    facts: `Breakeven ${money(SPREAD.breakeven)} · Max loss ${signedMoney(maxLoss)} · Max gain ${signedMoney(maxGain)}`,
  };
}

/** An analysis: NVDA's price line into today, then its three projected prices. */
export function analysisScreen() {
  // A 256×118 plot: prices 174–208 onto y 94–12; the last 21 sessions across x 8–146, the three
  // horizons at x 176, 212 and 246.
  const y = (price) => round(94 - ((price - 174) * 82) / 34);
  const history = OUTLOOK_HISTORY.map((s, i) => `${round(8 + (i * 138) / (OUTLOOK_HISTORY.length - 1))},${y(Number(s.close))}`);
  const today = { x: 146, y: y(SPOT) };
  const horizonX = [176, 212, 246];
  const projected = HERO_OUTLOOK.horizons.map((h, i) => ({ x: horizonX[i], y: y(h.price) }));
  return {
    ticker: "NVDA",
    name: COMPANY_NAME,
    price: money(SPOT),
    stamp: `Analysis · ${stampDate(AS_OF)}, ${AS_OF_CLOCK}`,
    history: history.join(" "),
    today,
    projection: [today, ...projected].map((p) => `${p.x},${p.y}`).join(" "),
    projected,
    horizons: HORIZON_CARDS.map((card) => ({
      label: card.label,
      price: `$${HERO_OUTLOOK.horizons.find((h) => h.horizon === card.key).price}`,
    })),
  };
}
