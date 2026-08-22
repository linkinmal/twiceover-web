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
// /go/* redirects — no page ever links straight to the app origin. All three land on the
// identical app entry point (auth-screens.md State A); the app decides what a visitor
// sees from there. Three distinct site routes exist to keep each site surface a
// separately measurable click (MQ2), not because the app treats them differently.
//   /go/try     — the hero entry-box demo (ticker forwarding is a separate, gated build)
//   /go/connect — the hero + closing-band "Connect read-only →" CTA
//   /go/signin  — the header "Sign in" slot
const APP_TRY_URL = "https://app.twiceover.io/";

const GO_PATHS = new Set(["/go/try", "/go/connect", "/go/signin"]);

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
        buildAppRedirect(APP_TRY_URL, url.searchParams, {
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
