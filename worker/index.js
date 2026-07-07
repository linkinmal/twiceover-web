// Thin Worker in front of the static site (twiceover-web's first-ever Worker code).
// Realizes ADR 0136 Option D — cookieless, first-party site measurement written to the
// SITE_METRICS Analytics Engine dataset. Two call sites:
//   1. a page-view record on every HTML page served (MQ1, MQ3-referrer/UTM, MQ4);
//   2. a click-event record on /go/try, the free-read CTA's same-origin redirect (MQ2),
//      which 302s to the app forwarding ONLY the three UTM keys.
//
// Emitted fields are EXACTLY six, exhaustively (ADR 0136 / consult 0163):
//   path, referrer (origin only), utm_source, utm_medium, utm_campaign, country.
// No IP, cookie, user-agent, or hash/identifier of any kind is read, retained, or
// written anywhere. scripts/deploy.sh + ci/check-worker-source.mjs assert this at the
// source level (denylist + writeDataPoint allowlist + console.* coverage) on every deploy.
//
// run_worker_first:true (wrangler.jsonc) lets this Worker see page navigations before
// falling through to env.ASSETS.fetch(request); assets otherwise serve without it.

// The free-read CTA hands off here. app.twiceover.io serves the read at its root; the
// exact free-read landing path is the #431 site->app seam's to finalize (the visible CTA
// is Reserved until app-launch #32 — this route is the ready mechanism it will point at).
const APP_TRY_URL = "https://app.twiceover.io/";

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

/**
 * Build the /go/try -> app redirect URL by re-serializing ONLY the three UTM keys onto the
 * app base (consult 0163 finding). The incoming query string is NEVER spread or passed
 * through — any other param a link generator or user appended is dropped here.
 */
export function buildAppRedirect(baseUrl, searchParams) {
  const dest = new URL(baseUrl);
  for (const key of UTM_KEYS) {
    const value = searchParams.get(key);
    if (value) dest.searchParams.set(key, value);
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

    // MQ2 — free-read CTA click. Log, then 302 to the app forwarding only UTM.
    if (url.pathname === "/go/try") {
      const referrer = refererOrigin(request.headers.get("referer"), url.origin);
      try {
        writeSiteMetric(env, { path: "/go/try", referrer, ...readUtm(url.searchParams), country });
      } catch {
        // A metrics write must never break the redirect.
      }
      return Response.redirect(buildAppRedirect(APP_TRY_URL, url.searchParams), 302);
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
