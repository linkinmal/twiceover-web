// Each rule in app-launch-rules.mjs, held to a page that breaks it — so a rule that matches nothing
// cannot pass silently (constitution "Declaration wired").
import { describe, expect, it } from "vitest";
import { appLaunchFailures } from "./app-launch-rules.mjs";
import { APP_COPY } from "../src/app-launch.mjs";

const HEADER = (current = false) =>
  `<header class="site-header"><a class="site-nav__app" href="/app"${current ? ' aria-current="page"' : ""}>Mobile app</a></header>`;
const FOOTER = `<nav class="footer-links" aria-label="Footer"><a href="/your-portfolio">x</a><a href="/app">Mobile app</a></nav>`;
const BANNER = `<meta name="apple-itunes-app" content="app-id=6804799140">`;
const NEXT = { iphone: "Android app coming soon.", android: "iPhone app coming soon." };
const BADGES = (stores, variant) =>
  stores.map((s) => `<a data-store-badge="${s}"></a>`).join("") +
  (NEXT[variant] ? `<p class="store-badges__next">${NEXT[variant]}</p>` : "") +
  `<div class="app-qr__code"></div>`;
const HOW = `<p class="closing-band__app"><a href="/app">Or get the mobile app →</a></p>`;
const END = `<a href="/">or go to twiceover.io</a><span class="e-sep" aria-hidden="true">·</span><a href="/app">get the mobile app</a>`;

function site({ variant = "iphone", stores = ["apple"], banner = true } = {}) {
  const b = banner ? BANNER : "";
  const page = (body, current = false) => `<head>${b}</head>${HEADER(current)}${body}${FOOTER}`;
  return {
    variant,
    postSlugs: ["a-post"],
    pages: {
      "index.html": page(`<a class="hero__app-link" href="/app">Get the mobile app →</a>${BADGES(stores, variant)}`),
      "app/index.html": page(BADGES(stores, variant) + BADGES(stores, variant) + `<p>${APP_COPY.planAnswer[variant]}</p>`, true),
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

  it("fails a missing header link, a QR count off the board, and a page that stopped building", () => {
    const noHeader = site();
    noHeader.pages["how-our-analysis-works/index.html"] = noHeader.pages["how-our-analysis-works/index.html"].replace(
      '<a class="site-nav__app" href="/app">Mobile app</a>',
      "",
    );
    expect.soft(appLaunchFailures(noHeader).join()).toMatch(/header has no Mobile app link/);
    const extraQr = site();
    extraQr.pages["index.html"] += '<div class="app-qr__code"></div>';
    expect.soft(appLaunchFailures(extraQr).join()).toMatch(/index\.html: expected 1 QR/);
    const gone = site();
    delete gone.pages["app/index.html"];
    expect.soft(appLaunchFailures(gone).join()).toMatch(/app\/index\.html: page missing/);
  });

  it("fails a coming-soon line in the wrong variant, the wrong store's line, and another variant's plan answer", () => {
    const both = site({ variant: "both", stores: ["apple", "play"] });
    both.pages["index.html"] += '<p class="store-badges__next">Android app coming soon.</p>';
    expect.soft(appLaunchFailures(both).join()).toMatch(/no coming-soon line/);
    const wrong = site();
    wrong.pages["index.html"] = wrong.pages["index.html"].replace("Android app coming soon.", "iPhone app coming soon.");
    expect.soft(appLaunchFailures(wrong).join()).toMatch(/Android app coming soon/);
    const plan = site();
    plan.pages["app/index.html"] = plan.pages["app/index.html"].replace(APP_COPY.planAnswer.iphone, APP_COPY.planAnswer.both);
    expect.soft(appLaunchFailures(plan).join()).toMatch(/plan answer/);
  });

  it("fails when no built post matched a slug, so the post-end rule cannot pass on nothing", () => {
    const s = site();
    delete s.pages["blog/a-post/index.html"];
    expect(appLaunchFailures(s).join()).toMatch(/checked nothing/);
  });

  it("fails /app without its header link marked current", () => {
    const s = site();
    s.pages["app/index.html"] = s.pages["app/index.html"].replace(' aria-current="page"', "");
    expect(appLaunchFailures(s).join()).toMatch(/app\/index\.html: the header's Mobile app link/);
  });

  it("fails the header link marked current anywhere but /app", () => {
    const s = site();
    s.pages["index.html"] = s.pages["index.html"].replace(HEADER(), HEADER(true));
    expect(appLaunchFailures(s).join()).toMatch(/marked current/);
  });
});
