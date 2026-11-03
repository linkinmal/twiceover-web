// Each rule in app-launch-rules.mjs, held to a page that breaks it — so a rule that matches nothing
// cannot pass silently (constitution "Declaration wired").
import { describe, expect, it } from "vitest";
import { appLaunchFailures } from "./app-launch-rules.mjs";

const HEADER = (current = false) =>
  `<header class="site-header"><a class="site-nav__app" href="/app"${current ? ' aria-current="page"' : ""}>Mobile app</a></header>`;
const FOOTER = `<nav class="footer-links" aria-label="Footer"><a href="/your-portfolio">x</a><a href="/app">Mobile app</a></nav>`;
const BANNER = `<meta name="apple-itunes-app" content="app-id=6804799140">`;
const BADGES = (stores) => stores.map((s) => `<a data-store-badge="${s}"></a>`).join("") + `<div class="app-qr__code"></div>`;
const HOW = `<p class="closing-band__app"><a href="/app">Or get the mobile app →</a></p>`;
const END = `<a href="/">or go to twiceover.io</a><span class="e-sep" aria-hidden="true">·</span><a href="/app">get the mobile app</a>`;

function site({ variant = "iphone", stores = ["apple"], banner = true } = {}) {
  const b = banner ? BANNER : "";
  const page = (body, current = false) => `<head>${b}</head>${HEADER(current)}${body}${FOOTER}`;
  return {
    variant,
    postSlugs: ["a-post"],
    pages: {
      "index.html": page(`<a class="hero__app-link" href="/app">Get the mobile app →</a>${BADGES(stores)}`),
      "app/index.html": page(BADGES(stores) + BADGES(stores), true),
      "how-our-analysis-works/index.html": page(HOW),
      "your-portfolio/index.html": page(HOW),
      "blog/a-post/index.html": page(END),
      "in-app/terms/index.html": "<head></head><main>terms</main>",
    },
  };
}

describe("appLaunchFailures", () => {
  it("passes a site that meets every rule, in each variant", () => {
    expect.soft(appLaunchFailures(site())).toEqual([]);
    expect.soft(appLaunchFailures(site({ variant: "both", stores: ["apple", "play"] }))).toEqual([]);
    expect.soft(appLaunchFailures(site({ variant: "android", stores: ["play"], banner: false }))).toEqual([]);
  });

  it("fails a badge from a store the variant does not show, and a missing one", () => {
    expect.soft(appLaunchFailures(site({ stores: ["apple", "play"] })).join()).toMatch(/play badge/);
    expect.soft(appLaunchFailures(site({ variant: "both", stores: ["apple"] })).join()).toMatch(/play badge/);
  });

  it("fails the banner in the Android-only variant, its absence elsewhere, and its presence on /in-app/*", () => {
    expect.soft(appLaunchFailures(site({ variant: "android", stores: ["play"] })).join()).toMatch(/Smart App Banner/);
    expect.soft(appLaunchFailures(site({ banner: false })).join()).toMatch(/Smart App Banner/);
    const s = site();
    s.pages["in-app/terms/index.html"] = `<head>${BANNER}</head>`;
    expect.soft(appLaunchFailures(s).join()).toMatch(/in-app\/terms.*Smart App Banner/);
  });

  it("fails a missing link: header, footer, hero, how-page, post end", () => {
    const cases = {
      "your-portfolio/index.html": [HOW, ""],
      "blog/a-post/index.html": [END, ""],
      "index.html": ['<a class="hero__app-link" href="/app">Get the mobile app →</a>', ""],
    };
    for (const [rel, [from, to]] of Object.entries(cases)) {
      const s = site();
      s.pages[rel] = s.pages[rel].replace(from, to);
      expect.soft(appLaunchFailures(s).join(), rel).toContain(rel);
    }
    const noFooter = site();
    noFooter.pages["how-our-analysis-works/index.html"] = noFooter.pages["how-our-analysis-works/index.html"].replace(FOOTER, "");
    expect.soft(appLaunchFailures(noFooter).join()).toMatch(/footer/);
  });

  it("fails the header link marked current anywhere but /app", () => {
    const s = site();
    s.pages["index.html"] = s.pages["index.html"].replace(HEADER(), HEADER(true));
    expect(appLaunchFailures(s).join()).toMatch(/marked current/);
  });
});
