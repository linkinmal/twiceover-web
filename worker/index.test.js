import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readUtm,
  refererOrigin,
  isHtmlPageView,
  buildAppRedirect,
  readTicker,
  readSupportCategory,
  readSupportRef,
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

  // The three UTM keys are the baseline every /go/* route forwards. Two more keys join
  // them below (stock-analyst-platform#3237) — bounded, and only when in-set; every param
  // outside that named set is still dropped, which is what this pins.
  it("forwards only the named keys, dropping every other incoming param", () => {
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
    "redirects %s to the app root, forwarding UTM and dropping every unnamed param",
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

  // The producing end of #3237's forwarding: the real dispatch path, not just the pure helper.
  // With no /contact entry in GO_DESTINATIONS yet, this is what keeps the forwarding from being
  // code nothing calls — every /go/* route carries the two bounded params through today, so the
  // /contact route lands later as a map entry needing no second change to the forwarder.
  it.each(["/go/connect", "/go/signin", "/go/try", "/go/plan"])(
    "forwards the support form's bounded category/ref through %s, and drops them out of set",
    async (path) => {
      const env = fakeEnv();
      const good = await worker.fetch(
        new Request(`https://twiceover.io${path}?category=feedback&ref=0a1b2c3d`),
        env,
      );
      const forwarded = new URL(good.headers.get("location"));
      expect(forwarded.searchParams.get("category")).toBe("feedback");
      expect(forwarded.searchParams.get("ref")).toBe("0a1b2c3d");

      const bad = await worker.fetch(
        new Request(`https://twiceover.io${path}?category=sales&ref=NOTAREF`),
        env,
      );
      const dropped = new URL(bad.headers.get("location"));
      expect(dropped.searchParams.has("category")).toBe(false);
      expect(dropped.searchParams.has("ref")).toBe(false);
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

/* ── The /contact deep-link params (stock-analyst-platform#3237) ──────────
   ADR 0859 makes twiceover.io/contact a redirect into the app-hosted support
   form, and support-request-form.md §6 gives that form two deep-link params:
   `category` (a closed five-member set) and `ref` (an 8-hex read reference).
   buildAppRedirect() dropped both, so every deep link arrived stripped — a
   working page with an empty field, which nothing fails on.

   Bounded then written with URLSearchParams.set(), the same two-step consult
   0739 pinned for the ticker. Unlike the ticker these are NOT opt-in: with no
   /contact route in GO_DESTINATIONS yet, an opt-in flag would have no truthy
   caller, so the forwarding would be a declaration nothing produces. Both
   sets are closed, so forwarding them on every /go/* route is inert where the
   destination has no use for them. */

describe("readSupportCategory", () => {
  it("accepts each member of the closed set support-request-form.md §6 names", () => {
    for (const ok of ["billing", "broker", "read", "feedback", "other"]) {
      expect(readSupportCategory(new URLSearchParams(`category=${ok}`))).toBe(ok);
    }
  });

  it("drops anything outside the set rather than passing it through", () => {
    for (const bad of ["Feedback", "FEEDBACK", " feedback", "feedback ", "sales", "", "<script>", "%00"]) {
      expect(readSupportCategory(new URLSearchParams(`category=${encodeURIComponent(bad)}`))).toBeNull();
    }
  });

  it("returns null when the param is absent entirely", () => {
    expect(readSupportCategory(new URLSearchParams("utm_source=ph"))).toBeNull();
  });

  it("rejects a CRLF payload rather than passing it toward the Location header", () => {
    const crlf = "feedback\r\nLocation: https://evil.example";
    expect(readSupportCategory(new URLSearchParams(`category=${encodeURIComponent(crlf)}`))).toBeNull();
  });
});

describe("readSupportRef", () => {
  it("accepts exactly the 8-lowercase-hex shape the form's Read reference takes", () => {
    expect(readSupportRef(new URLSearchParams("ref=0a1b2c3d"))).toBe("0a1b2c3d");
    expect(readSupportRef(new URLSearchParams("ref=00000000"))).toBe("00000000");
    expect(readSupportRef(new URLSearchParams("ref=ffffffff"))).toBe("ffffffff");
  });

  it("drops anything off that shape — wrong length, wrong case, wrong alphabet", () => {
    for (const bad of ["0a1b2c3", "0a1b2c3de", "0A1B2C3D", "0a1b-2c3d", "zzzzzzzz", "", "  0a1b2c3d"]) {
      expect(readSupportRef(new URLSearchParams(`ref=${encodeURIComponent(bad)}`))).toBeNull();
    }
  });

  it("returns null when the param is absent entirely", () => {
    expect(readSupportRef(new URLSearchParams("utm_source=ph"))).toBeNull();
  });

  it("rejects a CRLF payload rather than passing it toward the Location header", () => {
    const crlf = "0a1b2c3d\r\nLocation: https://evil.example";
    expect(readSupportRef(new URLSearchParams(`ref=${encodeURIComponent(crlf)}`))).toBeNull();
  });
});

describe("buildAppRedirect — /contact deep-link forwarding", () => {
  const base = "https://app.twiceover.io/";

  it("forwards both params alongside UTM, with no opt-in needed", () => {
    const url = new URL(
      buildAppRedirect(base, new URLSearchParams("category=feedback&ref=0a1b2c3d&utm_source=ph")),
    );
    expect(url.searchParams.get("category")).toBe("feedback");
    expect(url.searchParams.get("ref")).toBe("0a1b2c3d");
    expect(url.searchParams.get("utm_source")).toBe("ph");
  });

  it("forwards each independently — one present, the other absent", () => {
    const catOnly = new URL(buildAppRedirect(base, new URLSearchParams("category=billing")));
    expect([...catOnly.searchParams.keys()]).toEqual(["category"]);

    const refOnly = new URL(buildAppRedirect(base, new URLSearchParams("ref=0a1b2c3d")));
    expect([...refOnly.searchParams.keys()]).toEqual(["ref"]);
  });

  it("drops an out-of-set value instead of forwarding it", () => {
    const url = new URL(
      buildAppRedirect(base, new URLSearchParams("category=sales&ref=NOTAREF&utm_source=ph")),
    );
    expect(url.searchParams.has("category")).toBe(false);
    expect(url.searchParams.has("ref")).toBe(false);
    expect(url.searchParams.get("utm_source")).toBe("ph");
  });

  // URLSearchParams.get() returns the FIRST value, and dest.searchParams.set() writes a single
  // one — so a duplicated key cannot smuggle a second, unbounded value past the reader.
  it("takes the first value of a duplicated key and emits exactly one of it", () => {
    const url = new URL(
      buildAppRedirect(base, new URLSearchParams("category=feedback&category=sales&ref=0a1b2c3d&ref=zzzzzzzz")),
    );
    expect(url.searchParams.getAll("category")).toEqual(["feedback"]);
    expect(url.searchParams.getAll("ref")).toEqual(["0a1b2c3d"]);
  });

  // The reverse order: an out-of-set value FIRST drops the key entirely rather than falling
  // through to the valid duplicate behind it.
  it("drops the key when the first value is out of set, ignoring a valid duplicate behind it", () => {
    const url = new URL(
      buildAppRedirect(base, new URLSearchParams("category=sales&category=feedback")),
    );
    expect(url.searchParams.has("category")).toBe(false);
  });

  it("cannot be made to emit a Location carrying a raw CR or LF through either param", () => {
    const payload = encodeURIComponent("feedback\r\nX: y");
    const url = buildAppRedirect(base, new URLSearchParams(`category=${payload}&ref=${payload}`));
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

    // Consult 0739's trip-wire: only the named, bounded keys are ever forwarded — an
    // open-redirect param is not among them — and the destination itself comes from the
    // literal map, never from anything on the request.
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
   that actually pins the mechanism.

   HOTFIX (live incident, deployed then reverted-in-place same day): the first shipped
   form-action 'self' broke the hero entry-box's real submit — Chrome enforces
   form-action against the REDIRECT a form submission lands on, not only the form's own
   action= target. entry-form submits to /go/try (same-origin, fine); the Worker then
   302s to https://app.twiceover.io — cross-origin — and Chrome blocked that hop outright
   ("Sending form data to ... violates ... form-action 'self'"). No build-time scan or
   curl-based runtime check can see this: it is browser CSP enforcement over a live
   redirect chain, invisible to Node/undici and to wrangler dev + curl alike. It was
   caught only by loading the real page in a browser and submitting the form. The fix
   below is not something these unit tests can prove on their own for the same reason —
   they assert the header STRING is correct, never that a browser actually admits the
   redirect. That confirmation is a manual browser check, done alongside this change and
   after every future edit to this directive. https://app.twiceover.io is the identical
   literal GO_DESTINATIONS already permits as the only possible /go/* target (Security-
   reviewed as non-attacker-influenceable) — this widens form-action to name it
   explicitly, nothing more. */

const EXPECTED_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'none'; form-action 'self' https://app.twiceover.io; base-uri 'none'; frame-ancestors 'none'";

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
