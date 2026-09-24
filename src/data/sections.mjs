/**
 * The site's ONE list of analysis sections, in the band's order, each with the lowest plan that
 * includes it (stock-analyst-platform#3829; build reference
 * `ai-team/design/assets/homepage-3818-v3-2026-09-23.html`, ADR 0991; plan placement ADR 0929 and
 * Amendment 3, which struck Options structures and makes the count thirteen).
 *
 * ADR 0990: the section names and plan placement "must never disagree with /pricing or the homepage
 * band". So the band's cards, the synthesis chips and the facts strip's "6 / 10 / 13" all read from
 * here; nothing on the site types a section name or a section count of its own.
 *
 * Taglines are the artifact's, which carry the #3935 corrections (e.g. Fundamentals: "Market cap,
 * P/E, earnings", not the retired "Margins, growth, valuation") and Growth's #3693 second pass (no
 * "it/its" standing in for the unnamed stock). `short` is the synthesis chip's label.
 */

/** Lowest first; each plan includes every section of the plans before it. */
export const PLANS = ["free", "core", "premium"];

const PLAN_LABEL = { free: "Free", core: "Core", premium: "Premium" };

export const SECTIONS = [
  { key: "fundamentals", name: "Fundamentals", plan: "free", tagline: "Market cap, P/E, earnings — the numbers in context." },
  { key: "earnings", name: "Earnings & dividends", plan: "core", tagline: "The next report, and the move options price in for it." },
  { key: "earnings-history", name: "Earnings history", plan: "premium", tagline: "The last eight reports: what options implied, and what the stock did." },
  { key: "insiders", name: "Insiders", plan: "premium", tagline: "What officers and directors bought and sold, in their own filings." },
  { key: "technicals", name: "Technicals & levels", plan: "free", tagline: "Moving averages, momentum, and the 52-week range." },
  { key: "options", name: "Options & short interest", plan: "core", tagline: "The options market's expected move and skew, and how heavily the stock is shorted." },
  { key: "flow", name: "Large options trades", plan: "premium", tagline: "The biggest options trades of the last five sessions." },
  { key: "sector", name: "Sector regime", plan: "free", tagline: "The sector's own strength and valuation trend." },
  { key: "peers", name: "Peers & relative position", short: "Peers", plan: "free", tagline: "P/E and 3-month return against the stock's closest peers." },
  { key: "news", name: "News & catalysts", plan: "core", tagline: "What just changed, and what's scheduled next." },
  { key: "voices", name: "Voices", plan: "core", tagline: "What prominent market voices are saying — attributed." },
  { key: "macro", name: "Macro & regime", plan: "free", tagline: "The backdrop: rates, risk appetite, volatility." },
  { key: "outlook", name: "Outlook", plan: "free", tagline: "Near, mid and far — each stated as a condition." },
].map((s) => ({ short: s.name, ...s }));

/** The sections a plan shows: its own plus every lower plan's. */
export function sectionsOn(plan) {
  const rank = PLANS.indexOf(plan);
  return SECTIONS.filter((s) => PLANS.indexOf(s.plan) <= rank);
}

/** The plan chip a band card carries — none for a Free section, which every plan shows. */
export function planTag(section) {
  return section.plan === "free" ? null : PLAN_LABEL[section.plan];
}

/** The facts strip's caption, composed from the counts rather than typed beside them. */
export function sectionCountLine() {
  const [free, core, premium] = PLANS.map((p) => sectionsOn(p).length);
  return `Sections in our analysis: ${free} on Free, ${core} on Core, all ${premium} on Premium.`;
}

const GROUP_LABEL = { free: "On every plan", core: "Added on Core", premium: "Added on Premium" };

/**
 * /pricing's section table (ADR 0912 Amendment 1 ruling 2): each section once, under the plan that
 * adds it, in the band's order — except that the Outlook leads its group, as the build reference
 * draws it, since it is the synthesis the other sections feed.
 */
export function sectionGroups() {
  const lead = (s) => (s.key === "outlook" ? 0 : 1);
  return PLANS.map((plan) => ({
    plan,
    label: GROUP_LABEL[plan],
    sections: SECTIONS.filter((s) => s.plan === plan).sort((a, b) => lead(a) - lead(b)),
  }));
}
