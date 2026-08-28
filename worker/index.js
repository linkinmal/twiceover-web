// Thin Worker in front of the static site (twiceover-web's first-ever Worker code).
// Realizes ADR 0136 Option D — cookieless, first-party site measurement written to the
// SITE_METRICS Analytics Engine dataset. Two call sites:
//   1. a page-view record on every HTML page served (MQ1, MQ3-referrer/UTM, MQ4);
//   2. a click-event record on every /go/* route (MQ2), each a same-origin redirect
//      to app.twiceover.io forwarding ONLY the three UTM keys.
//
// Emitted fields are EXACTLY six, exhaustively (ADR 0136 / consult 0163):
//   path, referrer (origin only), utm_source, utm_medium, utm_campaign, country.
// No IP, cookie, user-agent, or hash/identifier of any kind is read, retained, or
// written anywhere. scripts/deploy.sh + ci/check-worker-source.mjs assert this at the
// source level (denylist + writeDataPoint allowlist + console.* coverage) on every deploy.
//
// run_worker_first:true (wrangler.jsonc) lets this Worker see page navigations before
// falling through to env.ASSETS.fetch(request); assets otherwise serve without it.

// The site→app routing contract (ai-team/growth/site-app-seam.md §3, #1754): every
// crossing from twiceover-web to app.twiceover.io goes through one of these same-origin
// /go/* redirects — no page ever links straight to the app origin. Each is also a
// separately measurable click (MQ2). CORRECTED for stock-analyst-platform#2541 (ADR 0742):
// they no longer all land on the identical app entry point — /go/signin and /go/connect
// deep-link their own hash routes, and the app decides what a visitor actually sees there.
//   /go/try     — the hero entry-box demo (ticker forwarding is a separate, gated build)
//               — and /pricing's Free card "Run a free read" CTA (#2513)
//   /go/connect — the hero + closing-band "Connect read-only →" CTA
//   /go/signin  — the header "Sign in" slot
//   /go/plan    — /pricing's Core card "Start 14-day trial" CTA (#2514)
const APP_TRY_URL = "https://app.twiceover.io/";

/**
 * Per-route app destination — HARDCODED, one literal per route, never derived from anything in the
 * request (#2520, founder-directed). Consult 0739's trip-wire is explicit that a /go/* destination
 * becoming "dynamic or attacker-influenceable" reopens it, so this stays a closed literal map: no
 * `next=`/`redirect_to=` param is read, and an unlisted path can't reach the redirect at all.
 *
 * `/go/signin` opens the app's auth screen (`#signin`) directly instead of dropping the visitor on
 * the app root to go find it — the founder's ask, and `#signin` is an established deep-link target
 * (`apps/web/src/shell/route.ts` parses it; `PlansSurface.tsx` already links `#signin?intent=`).
 *
 * `/go/connect` deep-links `#connection` (stock-analyst-platform#2541, ADR 0742). **This reverses
 * this comment's own previous claim** that it "deliberately still lands on the root" because
 * "opening the connector needs an account AND a Core trial first, which is an unsolved UX problem":
 * #2527 solved it. The app's `ConnectionRoute` gates that hash itself, so the site can point
 * straight at the thing its CTA names rather than hiding it behind a generic landing.
 *
 * **What that gate does is no longer what this comment used to say** (ADR 0742 Amendment 1 and ADR
 * 0748 Amendment 3, both 2026-08-28, off the founder decision on epic
 * stock-analyst-platform#2811 — a signed-up Free account may connect a brokerage read-only).
 * `ConnectionRoute` now branches on **session status alone**: any signed-in visitor reaches the
 * connector, Free included, and a signed-out one goes to `#signin?dest=connection`. The two claims
 * this comment carried are both dead — Free is not sent to `#plans?dest=connection` (that road is
 * deleted, not widened), and the sign-in target no longer carries `intent=core` (nothing is left for
 * it to select). The "three transitions" framing goes with them: there are two, and Amendment 3
 * struck this page's own caption that disclosed the third (stock-analyst-platform#2852).
 *
 * `/go/plan` below is unaffected — that is the subscribe road, where a Core intent is still real.
 *
 * `/go/plan` opens the auth screen carrying the Core plan intent (stock-analyst-platform#2514,
 * site-app-seam.md §3 row 4). Two details there are load-bearing, and §3 v1.1 had to correct both
 * after the app shipped — each fails SILENTLY, returning a correct-looking 302 to the right origin:
 *   - the carrier is **`intent`**, not `plan`. The app's `plan` field is a pre-ADR-0404 dead branch
 *     that `authHashRoute.ts` no longer reads at all.
 *   - it rides **inside the hash fragment**, never the query string. `parseAuthHashRoute()` splits
 *     the hash on "?" and parses that substring; `buildAppRedirect()` re-serializes onto
 *     `searchParams`, which that parser never looks at. So the intent is baked into this literal
 *     rather than passed as a param — the UTM keys still ride the query beside it, untouched.
 */
const GO_DESTINATIONS = {
  "/go/try": APP_TRY_URL,
  "/go/connect": `${APP_TRY_URL}#connection`,
  "/go/signin": `${APP_TRY_URL}#signin`,
  "/go/plan": `${APP_TRY_URL}#signin?intent=core`,
};

const GO_PATHS = new Set(Object.keys(GO_DESTINATIONS));

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"];

/** The three UTM values, each "" when absent. Never any other query key. */
export function readUtm(searchParams) {
  const utm = {};
  for (const key of UTM_KEYS) utm[key] = searchParams.get(key) ?? "";
  return utm;
}

/**
 * Origin only of the referring site (e.g. "https://google.com"), never the full URL or
 * query string. "" when absent, malformed, or same-origin (an internal nav is not a
 * channel). This is the ONLY thing read from the referer header.
 */
export function refererOrigin(referer, selfOrigin) {
  if (!referer) return "";
  try {
    const origin = new URL(referer).origin;
    return origin === selfOrigin ? "" : origin;
  } catch {
    return "";
  }
}

/** A page view is a GET that resolved to a 200 HTML document — not an asset, not a 404. */
export function isHtmlPageView(request, response) {
  return (
    request.method === "GET" &&
    response.status === 200 &&
    (response.headers.get("content-type") || "").toLowerCase().includes("text/html")
  );
}

/** The bounded ticker pattern — identical to twiceover-app's admission-client.ts. */
export const TICKER_PATTERN = /^[A-Z]{1,6}$/;

/**
 * The typed ticker, normalized then bounded — or null when absent or out of pattern.
 * Normalize-then-validate (not validate-only) so a lower-case "nvda" is carried rather
 * than silently dropped; anything still outside /^[A-Z]{1,6}$/ after that is discarded,
 * never forwarded. Public data by construction (consult 0739), so it may travel in a
 * query string to our own Worker — but it is never written to site metrics (consult 0163).
 */
export function readTicker(searchParams) {
  const raw = searchParams.get("ticker");
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return TICKER_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Build the /go/try -> app redirect URL by re-serializing ONLY the three UTM keys onto the
 * app base (consult 0163 finding). The incoming query string is NEVER spread or passed
 * through — any other param a link generator or user appended is dropped here.
 */
export function buildAppRedirect(baseUrl, searchParams, { forwardTicker = false } = {}) {
  const dest = new URL(baseUrl);
  for (const key of UTM_KEYS) {
    const value = searchParams.get(key);
    if (value) dest.searchParams.set(key, value);
  }
  // Only /go/try opts in (#2520). Every value goes through URLSearchParams.set(), never
  // string concatenation — consult 0739's added guardrail: concatenating an unvalidated
  // value into the Location header is the CRLF-injection seam. Bounding it here as well
  // is defence in depth; twiceover-app's admission-client.ts validates it again on arrival.
  if (forwardTicker) {
    const ticker = readTicker(searchParams);
    if (ticker) dest.searchParams.set("ticker", ticker);
  }
  return dest.toString();
}

/**
 * The single write path into SITE_METRICS. The destructured parameter names AND the blobs
 * array below are the exhaustive six-field contract the deploy gate enforces; changing
 * either without updating the gate fails the deploy.
 */
function writeSiteMetric(env, { path, referrer, utm_source, utm_medium, utm_campaign, country }) {
  env.SITE_METRICS.writeDataPoint({
    blobs: [path, referrer, utm_source, utm_medium, utm_campaign, country],
    indexes: [path],
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const country = (request.cf && request.cf.country) || "";

    // MQ2 — a /go/* CTA click. Log, then 302 to the app forwarding only UTM.
    if (GO_PATHS.has(url.pathname)) {
      const referrer = refererOrigin(request.headers.get("referer"), url.origin);
      try {
        writeSiteMetric(env, { path: url.pathname, referrer, ...readUtm(url.searchParams), country });
      } catch {
        // A metrics write must never break the redirect.
      }
      return Response.redirect(
        buildAppRedirect(GO_DESTINATIONS[url.pathname], url.searchParams, {
          forwardTicker: url.pathname === "/go/try",
        }),
        302,
      );
    }

    // Serve the asset first, then record a page view only for real HTML documents. An AE
    // failure (e.g. quota) must never prevent the page from being served.
    const response = await env.ASSETS.fetch(request);
    if (isHtmlPageView(request, response)) {
      const referrer = refererOrigin(request.headers.get("referer"), url.origin);
      try {
        writeSiteMetric(env, { path: url.pathname, referrer, ...readUtm(url.searchParams), country });
      } catch {
        // Serving the page takes priority over recording the metric.
      }
    }
    return response;
  },
};
