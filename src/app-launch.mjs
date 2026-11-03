// The app launch surfaces (app-launch-surfaces.md, consult 1178, stock-analyst-platform#4598): which
// stores the site shows, where their badges lead, and the copy every surface shares.
//
// THE VARIANT is a build-time choice, one held PR with three build variants (§2 "Variants"): both stores,
// iPhone only, Android only. The site shows only the stores that are live; nothing else moves.
// `SITE_APP_STORES` selects it at build; unset, the committed default below is used. An unknown value
// fails the build rather than guessing a store. Its retirement once both apps are live is tracked on the
// trip-wires issue (stock-analyst-platform#4598).
//
// COPY is Growth's (app-launch-kit.md §5) where Growth wrote it, the Designer's (§3 and the boards)
// where the spec says so. Never reword either here; change the source doc and copy it across.
import { existsSync } from "node:fs";
import { join } from "node:path";
import BROKER_LIST from "./data/brokers.json" with { type: "json" };

export const APP_STORE_VARIANTS = Object.freeze(["both", "iphone", "android"]);

/** The stores live at merge. iPhone first: Apple's release is expected before Google's brand approval. */
export const DEFAULT_APP_STORES = "iphone";

export function parseAppStores(raw, fallback = DEFAULT_APP_STORES) {
  const value = raw === undefined || raw === "" ? fallback : raw;
  if (!APP_STORE_VARIANTS.includes(value)) {
    throw new Error(`SITE_APP_STORES must be one of ${APP_STORE_VARIANTS.join(", ")}; got "${value}"`);
  }
  return value;
}

export const APP_STORES = parseAppStores(process.env.SITE_APP_STORES);

export const APP_STORE_ID = "6804799140";
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=io.twiceover.app";
export const APP_PAGE_PATH = "/app";
export const APP_PAGE_URL = "https://twiceover.io/app";

/** Official artwork, unaltered (§2 "Badges"). Apple's from its marketing guidelines; Google's is
 *  Growth's to supply once Google's brand review approves it. */
export const BADGE_ART = Object.freeze({
  apple: "/badges/app-store.svg",
  play: "/badges/google-play.svg",
});

/** Apple's and Google's trademark credit, once, on the Terms page (Security's store-badge ruling §2,
 *  founder-approved 2026-11-03; stock-analyst-platform#4597). One constant, so the page and the Terms
 *  credit check read the same words; if the brand reviews change them, change them here. */
export const STORE_BADGE_CREDIT =
  "Apple, the Apple logo and iPhone are trademarks of Apple Inc., registered in the U.S. and other countries. App Store is a service mark of Apple Inc., registered in the U.S. and other countries. Google Play and the Google Play logo are trademarks of Google LLC. Android is a trademark of Google LLC.";

/** The marker every rendered store badge carries and nothing else does. The Terms credit check
 *  (ci/content-rules.mjs, stock-analyst-platform#4597) reads it from the built pages. */
export const BADGE_MARKER = "data-store-badge";

/** What one variant shows: which badges (StoreBadges.astro draws Apple's first), and the line under a lone badge. */
export function storesFor(variant) {
  parseAppStores(variant);
  return {
    apple: variant !== "android",
    play: variant !== "iphone",
    comingSoon: variant === "iphone" ? "Android app coming soon." : variant === "android" ? "iPhone app coming soon." : null,
    // Safari's Smart App Banner offers the iPhone app, so it is absent where there is none (§2).
    smartAppBanner: variant !== "android",
  };
}

/** Fails the build when a variant needs badge art that is not committed, instead of an empty slot.
 *  `publicDir` defaults to the project root's, not this module's URL: Astro bundles it into dist/chunks. */
export function assertBadgeArt(variant, publicDir = join(process.cwd(), "public")) {
  const { apple, play } = storesFor(variant);
  const missing = [apple && BADGE_ART.apple, play && BADGE_ART.play].filter(
    (path) => path && !existsSync(`${publicDir}${path}`),
  );
  if (missing.length) {
    throw new Error(
      `The "${variant}" site variant needs badge art that is not committed: ${missing.join(", ")}. ` +
        "Google's badge arrives from Growth after Google's brand approval (app-launch-surfaces.md §2).",
    );
  }
}

/** Growth §5 and the Designer's boards — the strings the surfaces share. */
export const APP_COPY = Object.freeze({
  headline: "Your book, checked against your rules, on your phone.",
  sub: "One account on your phone and the web, so your rules and your connected broker come with you.",
  title: "TwiceOver mobile app: your book, checked against your rules",
  description:
    "Every position you hold, checked against your profit targets and loss limits. One account on your phone and the web.",
  // Homepage section, three phones in the order a trader moves (§2; Main board).
  phoneCaptions: Object.freeze({
    portfolio: "Your Portfolio, against your rules",
    position: "One position and the rule it is near",
    analysis: "Any US-listed stock's analysis, opening with its three projected prices",
  }),
  homeQr: "Scan to get the app on your phone.",
  homeQrHint: "Opens twiceover.io/app",
  appQr: "On a computer? Scan to open this page on your phone.",
  blocks: Object.freeze([
    {
      id: "app-block-rules",
      heading: "Your book, against your rules",
      body: "Set your profit targets, loss limits and days-to-expiry rules once. TwiceOver checks each rule against the positions it fits. Every position then shows the rule it is near: reached, approaching or not met.",
      screen: "position",
    },
    {
      id: "app-block-analysis",
      heading: "Any US-listed stock's analysis opens with three projected prices",
      body: "The near price looks 1–2 weeks out, the mid 2–3 months and the far about 6 months. Each comes with its date and its thesis. Below them, the analysis weighs the largest options trades, insiders, what named traders on X are saying, macro, key levels and earnings against the implied move.",
      screen: "analysis",
    },
    {
      id: "app-block-account",
      heading: "The same account on phone and web",
      body: "Sign in with the same email on your phone and the web. Your rules and your connected broker are on both. Change a rule on your phone and the web checks the new one.",
      screen: "account",
    },
  ]),
  faq: Object.freeze([
    {
      q: "Does TwiceOver place trades?",
      a: "No. The broker connection is read-only. TwiceOver never places, changes or cancels an order.",
    },
    {
      q: "Do I need a broker to use it?",
      a: "No. The analysis of any US-listed stock works without one. Your Portfolio needs a connected broker.",
    },
    {
      q: "Which brokers can I connect?",
      // Read from the explainer's broker list (Growth §5), never a frozen copy (ADR 0990).
      a: `${BROKER_LIST.brokers.join(", ")} and more. You can connect from the app or from the web.`,
    },
  ]),
  planQuestion: "Is my plan the same in the app?",
  planAnswer: Object.freeze({
    both: "Yes. Sign in with the same email and your plan works on the web, iPhone and Android. Plans are sold on the web and in the iPhone app.",
    iphone: "Yes. Sign in with the same email and your plan works on the web and on iPhone. Plans are sold in both places.",
    android: "Yes. Sign in with the same email and your plan works on the web and on Android. Plans are sold on the web.",
  }),
  // S7 (app-launch-kit.md §5): the Pricing page's line under the merchant-of-record one. Sale sentence
  // first, so "Android" never sits beside a sale word; a store is named only where that app is live.
  pricingLine: Object.freeze({
    both: "Plans are sold on the web and in the iPhone app. Sign in with the same email and your plan works on the web, iPhone and Android.",
    iphone: "Plans are sold on the web and in the iPhone app. Sign in with the same email and your plan works on both.",
    android: "Plans are sold on the web. Sign in with the same email and your plan works on the web and on Android.",
  }),
  // Web-scoped billing copy (app-launch-kit.md §5, rows for the merchant-of-record line and the cancel FAQ).
  // With S7 saying plans are also sold in the iPhone app, an unscoped "sold by Dodo", "prices in USD" or
  // "cancel anytime" is false for an iPhone buyer (Terms, "Who bills you"). HTML, rendered with set:html.
  morLineHtml: "Web subscriptions are sold by <strong>Dodo Payments</strong>, our merchant of record; TwiceOver is the software and service you're using. Web prices are in USD. You can cancel a web subscription anytime; see the <a href=\"/refunds\">Refund Policy</a>.",
  cancelWebHtml: "On the web, cancel in one click in Settings, with no retention flow, call or form. Cancelling during a trial means no charge. On a paid plan, your plan stays on until the end of the period you've paid for, then the account moves to Free. Your rules, broker connection and analysis history are kept. Web refunds are handled by Dodo Payments, our merchant of record. See the <a href=\"/refunds\">Refund Policy</a>.",
  // Appended after the web part only where the iPhone app is live.
  cancelIphone: "If you subscribed in the iPhone app, cancel in your iPhone's Settings under Subscriptions at least 24 hours before the renewal. Apple handles refunds for those purchases.",
  closing: "Get TwiceOver on your phone.",
  previewCaption: "The same account on every screen.",
  // §4 links, one label across the product.
  navLabel: "Mobile app",
  heroLink: "Get the mobile app →",
  howPageLink: "Or get the mobile app →",
  blogEndLink: "get the mobile app",
});
