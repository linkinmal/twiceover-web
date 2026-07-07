import { describe, it, expect } from "vitest";
import { readUtm, refererOrigin, isHtmlPageView, buildAppRedirect } from "./index.js";

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
