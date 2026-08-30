import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readUtm,
  refererOrigin,
  isHtmlPageView,
  buildAppRedirect,
  readTicker,
} from "./index.js";
import worker from "./index.js";

const SELF = "https://twiceover.io";

describe("readUtm", () => {
  it("reads exactly the three UTM keys, defaulting missing ones to empty string", () => {
    const utm = readUtm(new URLSearchParams("utm_source=ph&utm_campaign=launch"));
    expect(utm).toEqual({ utm_source: "ph", utm_medium: "", utm_campaign: "launch" });
  });

  it("ignores any non-UTM query param", () => {
    const utm = readUtm(new URLSearchParams("utm_source=hn&foo=bar&email=a@b.com"));
    expect(utm).toEqual({ utm_source: "hn", utm_medium: "", utm_campaign: "" });
  });
});

describe("refererOrigin", () => {
  it("returns the origin only of an external referrer, never the path or query", () => {
    expect(refererOrigin("https://www.google.com/search?q=twiceover&x=y", SELF)).toBe(
      "https://www.google.com",
    );
  });

  it("drops a same-origin (internal) referrer to empty string", () => {
    expect(refererOrigin("https://twiceover.io/pricing", SELF)).toBe("");
  });

  it("returns empty string for an absent or malformed referrer", () => {
    expect(refererOrigin(null, SELF)).toBe("");
    expect(refererOrigin("", SELF)).toBe("");
    expect(refererOrigin("not a url", SELF)).toBe("");
  });
});

describe("isHtmlPageView", () => {
  const res = (status, contentType) =>
    new Response(null, { status, headers: contentType ? { "content-type": contentType } : {} });

  it("is true for a GET that resolved to a 200 HTML document", () => {
    expect(isHtmlPageView({ method: "GET" }, res(200, "text/html; charset=utf-8"))).toBe(true);
  });

  it("is false for a non-GET, a non-200, or a non-HTML response", () => {
    expect(isHtmlPageView({ method: "POST" }, res(200, "text/html"))).toBe(false);
    expect(isHtmlPageView({ method: "GET" }, res(404, "text/html"))).toBe(false);
    expect(isHtmlPageView({ method: "GET" }, res(200, "image/svg+xml"))).toBe(false);
    expect(isHtmlPageView({ method: "GET" }, res(200, null))).toBe(false);
  });
});

describe("buildAppRedirect", () => {
  const base = "https://app.twiceover.io/";

  it("forwards only the three UTM keys, dropping every other incoming param", () => {
    const url = buildAppRedirect(
      base,
      new URLSearchParams("utm_source=ph&utm_medium=social&utm_campaign=launch&foo=SECRET&token=abc"),
    );
    const out = new URL(url);
    expect(out.origin + out.pathname).toBe("https://app.twiceover.io/");
    expect(out.searchParams.get("utm_source")).toBe("ph");
    expect(out.searchParams.get("utm_medium")).toBe("social");
    expect(out.searchParams.get("utm_campaign")).toBe("launch");
    expect(out.searchParams.has("foo")).toBe(false);
    expect(out.searchParams.has("token")).toBe(false);
    expect([...out.searchParams.keys()].sort()).toEqual(["utm_campaign", "utm_medium", "utm_source"]);
  });

  it("omits UTM keys that are absent (no empty-value params)", () => {
    const url = buildAppRedirect(base, new URLSearchParams("utm_source=hn"));
    const out = new URL(url);
    expect([...out.searchParams.keys()]).toEqual(["utm_source"]);
  });

  it("adds no query string at all when the incoming request carries none", () => {
    expect(buildAppRedirect(base, new URLSearchParams(""))).toBe("https://app.twiceover.io/");
  });
});

// /go/* dispatch (#1754, site-app-seam.md §3) — the fetch handler itself, not just the
// pure helpers above: each route is a same-origin redirect to the identical app entry
// point, logging a click with the six-field metric contract before it 302s.
describe("fetch — /go/* routes", () => {
  function fakeEnv() {
    return { SITE_METRICS: { writeDataPoint: vi.fn() }, ASSETS: { fetch: vi.fn() } };
  }

  beforeEach(() => vi.clearAllMocks());

  it.each(["/go/connect", "/go/signin", "/go/try", "/go/plan"])(
    "redirects %s to the app root, forwarding only UTM and dropping every other param",
    async (path) => {
      const env = fakeEnv();
      const request = new Request(
        `https://twiceover.io${path}?utm_source=ph&utm_campaign=launch&foo=SECRET`,
      );
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(302);
      const location = new URL(response.headers.get("location"));
      expect(location.origin + location.pathname).toBe("https://app.twiceover.io/");
      expect(location.searchParams.get("utm_source")).toBe("ph");
      expect(location.searchParams.get("utm_campaign")).toBe("launch");
      expect(location.searchParams.has("foo")).toBe(false);
      expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    },
  );

  it("logs a click with the six-field contract, keyed to the route's own path", async () => {
    const env = fakeEnv();
    const request = new Request("https://twiceover.io/go/connect?utm_source=ph", {
      headers: { referer: "https://www.google.com/search?q=x" },
    });
    await worker.fetch(request, env);

    expect(env.SITE_METRICS.writeDataPoint).toHaveBeenCalledWith({
      blobs: ["/go/connect", "https://www.google.com", "ph", "", "", ""],
      indexes: ["/go/connect"],
    });
  });

  it("still 302s even when the metrics write throws", async () => {
    const env = fakeEnv();
    env.SITE_METRICS.writeDataPoint.mockImplementation(() => {
      throw new Error("AE quota exceeded");
    });
    const response = await worker.fetch(new Request("https://twiceover.io/go/signin"), env);

    expect(response.status).toBe(302);
    // #2520: /go/signin's destination is the auth screen, not the app root.
    expect(response.headers.get("location")).toBe("https://app.twiceover.io/#signin");
  });

  /* stock-analyst-platform#2514, site-app-seam.md §3 row 4 (v1.1 correction). The Core
     card's "Start 14-day trial" CTA carries its plan intent to the app, and BOTH halves
     of how it does that are silent-failure seams the doc had to correct twice:
       - the carrier is `intent`, not `plan` — the app's `plan` field is a pre-ADR-0404
         dead branch that reaches nothing;
       - it must ride INSIDE the hash fragment. `authHashRoute.ts` parses by splitting the
         hash on "?" and reading THAT substring; a real query param is never read.
     Either mistake still returns a 302 to the right origin, which is why status- and
     origin-level assertions cannot catch it — this asserts the hash itself. */
  it("carries the Core plan intent inside the hash fragment, where the app's parser reads it", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request("https://twiceover.io/go/plan?utm_source=ph&foo=SECRET"),
      env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location"));
    // The intent lives in the hash — not in searchParams, where it would be dropped on the floor.
    expect(location.hash).toBe("#signin?intent=core");
    expect(location.searchParams.has("intent")).toBe(false);
    // UTM still rides the query string, unchanged by the hash carrier sitting beside it.
    expect(location.searchParams.get("utm_source")).toBe("ph");
    expect(location.searchParams.has("foo")).toBe(false);
    // The app's own parser is the authority on that string — mirror its split here so a
    // future edit to the destination that breaks parsing fails this test, not production.
    const [routeName, query = ""] = location.hash.replace(/^#/, "").split("?");
    expect(routeName).toBe("signin");
    expect(new URLSearchParams(query).get("intent")).toBe("core");
  });

  it("does not forward a ticker on /go/plan — only /go/try opts in", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request("https://twiceover.io/go/plan?ticker=NVDA"),
      env,
    );

    const location = new URL(response.headers.get("location"));
    expect(location.searchParams.has("ticker")).toBe(false);
    expect(location.hash).toBe("#signin?intent=core");
  });

  it("never redirects an unrecognized /go/* path — falls through to the static asset (404)", async () => {
    const env = fakeEnv();
    env.ASSETS.fetch.mockResolvedValue(new Response("not found", { status: 404 }));
    const response = await worker.fetch(new Request("https://twiceover.io/go/nope"), env);

    expect(response.status).toBe(404);
    expect(env.SITE_METRICS.writeDataPoint).not.toHaveBeenCalled();
  });
});

/* ── Live ticker handoff (#2520, consult 0739) ────────────────────────────
   The entry-box's real GET submit carries `ticker` to /go/try. Two invariants
   Security's close pins: the value is bounded to /^[A-Z]{1,6}$/ BEFORE it
   leaves this Worker, and it is written with URLSearchParams.set() — never
   concatenated into the Location header (the CRLF-injection seam). */

describe("readTicker", () => {
  it("normalizes a typed symbol the way the app does — trimmed and upper-cased", () => {
    expect(readTicker(new URLSearchParams("ticker=nvda"))).toBe("NVDA");
    expect(readTicker(new URLSearchParams("ticker=%20aapl%20"))).toBe("AAPL");
    expect(readTicker(new URLSearchParams("ticker=BRK"))).toBe("BRK");
  });

  it("accepts the full bounded range and nothing past it", () => {
    expect(readTicker(new URLSearchParams("ticker=F"))).toBe("F");
    expect(readTicker(new URLSearchParams("ticker=ABCDEF"))).toBe("ABCDEF");
    expect(readTicker(new URLSearchParams("ticker=ABCDEFG"))).toBeNull();
  });

  it("rejects anything that is not a plain alphabetic symbol", () => {
    for (const bad of ["NVDA1", "NV DA", "NV.DA", "BRK-B", "", "   ", "<script>", "%00"]) {
      expect(readTicker(new URLSearchParams(`ticker=${encodeURIComponent(bad)}`))).toBeNull();
    }
  });

  it("returns null when the param is absent entirely", () => {
    expect(readTicker(new URLSearchParams("utm_source=ph"))).toBeNull();
  });

  it("rejects a CRLF payload rather than normalizing it into something forwardable", () => {
    const crlf = "NVDA\r\nLocation: https://evil.example";
    expect(readTicker(new URLSearchParams(`ticker=${encodeURIComponent(crlf)}`))).toBeNull();
  });
});

describe("buildAppRedirect — ticker forwarding", () => {
  const base = "https://app.twiceover.io/";

  it("forwards a valid ticker only when the caller opts in, alongside UTM", () => {
    const url = new URL(
      buildAppRedirect(base, new URLSearchParams("ticker=nvda&utm_source=ph"), {
        forwardTicker: true,
      }),
    );
    expect(url.searchParams.get("ticker")).toBe("NVDA");
    expect(url.searchParams.get("utm_source")).toBe("ph");
  });

  it("does not forward the ticker by default — the other /go/* routes are unchanged", () => {
    const url = new URL(buildAppRedirect(base, new URLSearchParams("ticker=NVDA")));
    expect(url.searchParams.has("ticker")).toBe(false);
  });

  it("drops an out-of-pattern value instead of forwarding it", () => {
    const url = new URL(
      buildAppRedirect(base, new URLSearchParams("ticker=NOT_A_TICKER"), { forwardTicker: true }),
    );
    expect(url.searchParams.has("ticker")).toBe(false);
  });

  it("cannot be made to emit a Location carrying a raw CR or LF", () => {
    const url = buildAppRedirect(
      base,
      new URLSearchParams(`ticker=${encodeURIComponent("A\r\nX: y")}`),
      { forwardTicker: true },
    );
    expect(url).not.toMatch(/[\r\n]/);
    expect(url).toBe("https://app.twiceover.io/");
  });
});

describe("fetch — /go/try ticker handoff", () => {
  function fakeEnv() {
    return { SITE_METRICS: { writeDataPoint: vi.fn() }, ASSETS: { fetch: vi.fn() } };
  }

  beforeEach(() => vi.clearAllMocks());

  it("carries the typed ticker to the app, normalized", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request("https://twiceover.io/go/try?ticker=nvda&utm_source=ph"),
      env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location"));
    expect(location.origin + location.pathname).toBe("https://app.twiceover.io/");
    expect(location.searchParams.get("ticker")).toBe("NVDA");
    expect(location.searchParams.get("utm_source")).toBe("ph");
  });

  it.each(["/go/connect", "/go/signin"])(
    "does not carry a ticker on %s — only /go/try forwards it",
    async (path) => {
      const env = fakeEnv();
      const response = await worker.fetch(new Request(`https://twiceover.io${path}?ticker=NVDA`), env);

      expect(new URL(response.headers.get("location")).searchParams.has("ticker")).toBe(false);
    },
  );

  it("drops an invalid ticker and still redirects cleanly", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request("https://twiceover.io/go/try?ticker=%3Cscript%3E"),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.twiceover.io/");
  });

  it("never writes the typed ticker into site metrics (consult 0739 / 0163 trip-wire)", async () => {
    const env = fakeEnv();
    await worker.fetch(new Request("https://twiceover.io/go/try?ticker=NVDA&utm_source=ph"), env);

    const call = env.SITE_METRICS.writeDataPoint.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain("NVDA");
    expect(call.blobs).toEqual(["/go/try", "", "ph", "", "", ""]);
  });
});

/* ── Per-route destinations (#2520, founder-directed) ─────────────────────
   /go/signin opens the app's auth screen directly rather than dropping the visitor on
   the app root to find it — `#signin` is an established deep-link target in the app
   (`PlansSurface.tsx` already uses `#signin?intent=`). Destinations stay HARDCODED per
   route, never derived from request input: consult 0739's trip-wire fires if a /go/*
   destination ever becomes dynamic or attacker-influenceable. */

describe("fetch — per-route app destinations", () => {
  function fakeEnv() {
    return { SITE_METRICS: { writeDataPoint: vi.fn() }, ASSETS: { fetch: vi.fn() } };
  }

  beforeEach(() => vi.clearAllMocks());

  it("sends /go/signin straight to the app's auth screen", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(new Request("https://twiceover.io/go/signin"), env);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.twiceover.io/#signin");
  });

  it("keeps the fragment after the query string when UTM rides along", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request("https://twiceover.io/go/signin?utm_source=ph"),
      env,
    );

    const location = response.headers.get("location");
    expect(location).toBe("https://app.twiceover.io/?utm_source=ph#signin");
    const url = new URL(location);
    expect(url.hash).toBe("#signin");
    expect(url.searchParams.get("utm_source")).toBe("ph");
  });

  it("leaves /go/try on the app root (unchanged)", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(new Request("https://twiceover.io/go/try"), env);

    expect(response.headers.get("location")).toBe("https://app.twiceover.io/");
  });

  // stock-analyst-platform#2541, ADR 0742 — /go/connect now deep-links the connector instead of
  // dropping the visitor on the app root. The app's own three-rung gate decides what they actually
  // see there (entitled -> the connector; Free -> the plans sheet; signed out -> sign-in carrying
  // intent=core&dest=connection), which is why the site can point straight at it.
  it("deep-links /go/connect to the app's connection route (ADR 0742)", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(new Request("https://twiceover.io/go/connect"), env);
    const location = response.headers.get("location");

    expect(location).toBe("https://app.twiceover.io/#connection");
    expect(new URL(location).hash).toBe("#connection");
  });

  it("keeps /go/connect's destination hardcoded — no request input can steer it", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request(
        "https://twiceover.io/go/connect?next=https://evil.example/&redirect_to=https://evil.example/&dest=rules",
      ),
      env,
    );
    const location = response.headers.get("location");

    // Consult 0739's trip-wire: only the three UTM keys are ever forwarded, and the destination
    // itself comes from the literal map, never from anything on the request.
    expect(location).toBe("https://app.twiceover.io/#connection");
    expect(location).not.toContain("evil.example");
  });

  it("never lets a request influence the destination host", async () => {
    const env = fakeEnv();
    const response = await worker.fetch(
      new Request(
        "https://twiceover.io/go/signin?next=https://evil.example&redirect_to=https://evil.example",
      ),
      env,
    );

    const location = response.headers.get("location");
    expect(new URL(location).origin).toBe("https://app.twiceover.io");
    expect(location).not.toContain("evil.example");
  });
});

/* ── Content-Security-Policy (stock-analyst-platform#2976, ADR 0810 build order item 2,
   consult 0811 Amendment 1) ──────────────────────────────────────────────────────────
   The Worker runs first on every request (run_worker_first:true), so it is the one place
   both response paths — the /go/* redirect and the env.ASSETS.fetch fall-through — can
   carry the same header. Both are asserted here, and both are asserted to arrive on a
   CLONE: Response.redirect() and ASSETS.fetch() each return a response whose headers are
   immutable in the Workers runtime, where a direct .set() silently no-ops. That failure
   is invisible to a header-presence assertion under Node/undici, which is why the
   identity assertion below (response !== the object the path started from) is the one
   that actually pins the mechanism. */

const EXPECTED_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

const GO_LOCATIONS = {
  "/go/try": "https://app.twiceover.io/",
  "/go/connect": "https://app.twiceover.io/#connection",
  "/go/signin": "https://app.twiceover.io/#signin",
  "/go/plan": "https://app.twiceover.io/#signin?intent=core",
};

describe("fetch — Content-Security-Policy", () => {
  function fakeEnv() {
    return { SITE_METRICS: { writeDataPoint: vi.fn() }, ASSETS: { fetch: vi.fn() } };
  }

  beforeEach(() => vi.clearAllMocks());

  it.each(["/go/try", "/go/connect", "/go/signin", "/go/plan"])(
    "carries the exact directive set on the %s redirect, without disturbing the redirect itself",
    async (path) => {
      const env = fakeEnv();
      const response = await worker.fetch(new Request(`https://twiceover.io${path}`), env);

      expect(response.headers.get("content-security-policy")).toBe(EXPECTED_CSP);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(GO_LOCATIONS[path]);
    },
  );

  it("carries the exact directive set on a served asset, preserving status, type and body", async () => {
    const env = fakeEnv();
    const asset = new Response("<!DOCTYPE html><p>hi</p>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    env.ASSETS.fetch.mockResolvedValue(asset);

    const response = await worker.fetch(new Request("https://twiceover.io/"), env);

    expect(response.headers.get("content-security-policy")).toBe(EXPECTED_CSP);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<!DOCTYPE html><p>hi</p>");
  });

  it("carries it on a non-HTML asset and on a 404 too — the header is not gated on the page-view branch", async () => {
    for (const [status, type] of [
      [200, "image/svg+xml"],
      [404, "text/html; charset=utf-8"],
    ]) {
      const env = fakeEnv();
      env.ASSETS.fetch.mockResolvedValue(new Response("x", { status, headers: { "content-type": type } }));
      const response = await worker.fetch(new Request("https://twiceover.io/favicon.svg"), env);
      expect(response.headers.get("content-security-policy")).toBe(EXPECTED_CSP);
      expect(response.status).toBe(status);
    }
  });

  /* The mechanism assertion, not the outcome assertion. A direct
     `assetResponse.headers.set(...)` passes every expectation above under Node/undici and
     silently no-ops against the Workers runtime's immutable-headers guard (ADR 0810
     Amendment 3 condition 3). Only "a new Response object came back" distinguishes them. */
  it("returns a mutable clone on both paths, never the immutable response it started from", async () => {
    const env = fakeEnv();
    const asset = new Response("<p>hi</p>", { headers: { "content-type": "text/html" } });
    env.ASSETS.fetch.mockResolvedValue(asset);

    const served = await worker.fetch(new Request("https://twiceover.io/"), env);
    expect(served).not.toBe(asset);

    const redirected = await worker.fetch(new Request("https://twiceover.io/go/try"), env);
    expect(redirected.headers.get("content-security-policy")).toBe(EXPECTED_CSP);
  });

  it("sets the header exactly once, never appending a second policy", async () => {
    const env = fakeEnv();
    env.ASSETS.fetch.mockResolvedValue(
      new Response("<p>hi</p>", { headers: { "content-type": "text/html" } }),
    );
    const response = await worker.fetch(new Request("https://twiceover.io/"), env);

    const all = [...response.headers].filter(([k]) => k === "content-security-policy");
    expect(all).toHaveLength(1);
    expect(all[0][1]).not.toMatch(/default-src[\s\S]*default-src/);
  });
});
