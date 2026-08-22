import { describe, it, expect, vi, beforeEach } from "vitest";
import { readUtm, refererOrigin, isHtmlPageView, buildAppRedirect } from "./index.js";
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

  it.each(["/go/connect", "/go/signin", "/go/try"])(
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
    expect(response.headers.get("location")).toBe("https://app.twiceover.io/");
  });

  it("never redirects an unrecognized /go/* path — falls through to the static asset (404)", async () => {
    const env = fakeEnv();
    env.ASSETS.fetch.mockResolvedValue(new Response("not found", { status: 404 }));
    const response = await worker.fetch(new Request("https://twiceover.io/go/nope"), env);

    expect(response.status).toBe(404);
    expect(env.SITE_METRICS.writeDataPoint).not.toHaveBeenCalled();
  });
});
