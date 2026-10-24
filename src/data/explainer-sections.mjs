/**
 * "How our analysis works", page 1's thirteen entries (stock-analyst-platform#3829; ADR 0990/0993;
 * copy is Growth's, `ai-team/growth/site-copy-explainer-pages.md`, verbatim as the build reference
 * `explainer-pages-3818-2026-09-24.html` sets it). Keyed by the one section list's keys: each entry's
 * name and plan come from `sections.mjs`, never from here, so page 1 cannot disagree with the band or
 * /pricing (ADR 0990's one-list rule; `explainer-sections.test.mjs` enforces the keys).
 *
 * The Outlook has one paragraph (`about`); every other section has "Shows" and "Feeds the Outlook".
 */
import { SECTIONS } from "./sections.mjs";

export const EXPLAINER_ENTRIES = {
  "outlook": {
    about: "Our AI synthesis of the other sections your plan includes. It projects three prices, one for each horizon, each with the thesis behind it.",
  },
  "fundamentals": {
    shows: "Market cap, P/E and earnings per share. Earnings come from the company's SEC filings and carry their fiscal year.",
    feeds: "Everything it shows, plus how revenue, margins, earnings per share, net cash or debt and share count are trending. The Outlook also sees where P/E sits against the stock's own past range.",
  },
  "earnings": {
    shows: "The next report's date and time, marked confirmed or projected, with the consensus estimates for earnings per share and revenue. The last report against its estimates, labelled GAAP or adjusted. The move options price in for the next report, and the next ex-dividend date and amount.",
    feeds: "The next report's date and time, its estimates and the move options price in for it. Also the last earnings surprise and the next ex-dividend date.",
  },
  "earnings-history": {
    shows: "The last eight reports. Each report shows its beat or miss, and how the stock actually moved against what options implied beforehand.",
    feeds: "How the stock has tended to move on report days, against what options implied.",
  },
  "insiders": {
    shows: "Open-market buying and selling by the company's officers and directors over the last six months, from their SEC Form 4 filings.",
    feeds: "Insiders' net buying or selling over those six months.",
  },
  "technicals": {
    shows: "The 50- and 200-day moving averages, RSI and the 52-week range, with today's price marked. Also how the stock has moved over the past five years, or its full history if shorter, across rolling 10-, 63- and 126-trading-day windows: the share that ended higher, the median move and the middle half of outcomes.",
    feeds: "Everything it shows, plus Fibonacci levels drawn from recent price swings and today's volume against its average.",
  },
  "options": {
    shows: "Put/call ratios for volume and open interest, implied volatility across expiries, skew and open interest by strike. Short interest as a share of shares outstanding, as of its settlement date, with days to cover.",
    feeds: "Implied volatility and the move options price in over each horizon. Where quotes allow, that implied move sets the Outlook's sense of scale. The Outlook also sees skew, put/call ratios, open interest by strike and short interest.",
  },
  "flow": {
    shows: "The largest options trades of the last five sessions. Each trade shows whether it was a call or a put, with its time, strike, expiry, size, premium and where it printed against the bid and ask.",
    feeds: "Everything it shows.",
  },
  "sector": {
    shows: "A short written summary of what is driving the stock's sector now. It covers things like demand, costs, policy, rotation and the sector's own earnings.",
    feeds: "Its written summary, as the backdrop for the stock.",
  },
  "peers": {
    shows: "The stock's closest peers, with P/E and 3-month return side by side. Also how closely the stock has moved with its sector fund and with the S&P 500 over the last 252 trading days, as beta and correlation of daily returns. Against the S&P 500 alone when the stock has no sector fund.",
    feeds: "Everything it shows.",
  },
  "news": {
    shows: "Recent SEC filings and the material news from major financial newsrooms: earnings, guidance, deals, share offerings, trial outcomes and leadership changes. Each item carries its source, its time and a one-line summary. The next monthly options expiry sits below.",
    feeds: "The recent SEC filings and, on Core and Premium, the headlines, each with its date.",
  },
  "voices": {
    shows: "What prominent traders on X are saying about the stock right now. Each post is linked, dated and summed up in one line.",
    feeds: "Each post's summary, with its author and date.",
  },
  "macro": {
    shows: "The market's near-term and quarterly regime, risk appetite, the event driving markets now and the economic calendar ahead. The Fed path, real yields, the dollar, credit spreads, copper against gold and the VIX term structure are one click down.",
    feeds: "The readings behind it, each with its date and how it moved since its last release. Also the published commentary on what is driving markets.",
  },
};

/** Page 1's order: the section list's own, which already leads with the Outlook. */
export const EXPLAINER_ORDER = SECTIONS.map((s) => s.key);

/** The entry's anchor, from the section's own name: "Earnings & dividends" → "s-earnings-and-dividends". */
export const entryAnchor = (name) => `s-${name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
