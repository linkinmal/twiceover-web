// The app launch surfaces, held against the built pages for the variant that was built
// (app-launch-surfaces.md §2–§4, stock-analyst-platform#4598). Pure: `check-app-launch.mjs` walks
// dist/ and hands the pages here; `app-launch-rules.test.mjs` holds each rule to a page that breaks it.
import { storesFor } from "../src/app-launch.mjs";

const count = (html, re) => (html.match(re) ?? []).length;
const BANNER = /<meta name="apple-itunes-app" content="app-id=6804799140">/g;
const BADGE = (store) => new RegExp(`data-store-badge="${store}"`, "g");
const QR = /class="app-qr__code"/g;
const NAV_APP = /<a class="site-nav__app" href="\/app"/g;
const FOOTER_APP = /<nav class="footer-links"[^]*?<a href="\/app">Mobile app<\/a>/;

// Pages that carry the badges and the QR, and how many sets each draws.
const BADGE_PAGES = { "index.html": 1, "app/index.html": 2 };
const HOW_PAGES = ["how-our-analysis-works/index.html", "your-portfolio/index.html"];

const isInApp = (rel) => rel.startsWith("in-app/");
const isPost = (rel, postSlugs) => postSlugs.some((slug) => rel === `blog/${slug}/index.html`);

export function appLaunchFailures({ pages, variant, postSlugs = [] }) {
  const want = storesFor(variant);
  const failures = [];
  const fail = (rel, msg) => failures.push(`[APP] ${rel}: ${msg}`);
  for (const [rel, html] of Object.entries(pages)) {
    const banners = count(html, BANNER);
    const wantBanner = want.smartAppBanner && !isInApp(rel) && html.includes('class="site-header"') ? 1 : 0;
    if (banners !== wantBanner) fail(rel, `expected ${wantBanner} Smart App Banner tag(s), found ${banners}`);

    const sets = BADGE_PAGES[rel] ?? 0;
    for (const store of ["apple", "play"]) {
      const expected = want[store] ? sets : 0;
      const found = count(html, BADGE(store));
      if (found !== expected) fail(rel, `expected ${expected} ${store} badge(s) in the "${variant}" variant, found ${found}`);
    }
    const qrs = count(html, QR);
    if (qrs !== sets) fail(rel, `expected ${sets} QR code(s), found ${qrs}`);

    if (html.includes('class="site-header"')) {
      if (count(html, NAV_APP) !== 1) fail(rel, "the header has no Mobile app link to /app");
      const current = /<a class="site-nav__app" href="\/app" aria-current="page"/.test(html);
      if (current !== (rel === "app/index.html")) fail(rel, "the header's Mobile app link is marked current off /app, or not on it");
      if (!FOOTER_APP.test(html)) fail(rel, "the footer has no Mobile app link to /app");
    }
    if (rel === "index.html" && !/<a class="hero__app-link" href="\/app">Get the mobile app →<\/a>/.test(html)) {
      fail(rel, "the hero has no Get the mobile app link");
    }
    if (HOW_PAGES.includes(rel) && !/<p class="closing-band__app"><a href="\/app">Or get the mobile app →<\/a><\/p>/.test(html)) {
      fail(rel, "the closing band has no Or get the mobile app line");
    }
    if (isPost(rel, postSlugs) && !/<a href="\/">or go to twiceover\.io<\/a><span class="e-sep" aria-hidden="true">·<\/span><a href="\/app">get the mobile app<\/a>/.test(html)) {
      fail(rel, "the post's end has no get the mobile app link beside or go to twiceover.io");
    }
  }
  for (const rel of [...Object.keys(BADGE_PAGES), ...HOW_PAGES]) {
    if (!(rel in pages)) fail(rel, "page missing from the build");
  }
  return failures;
}
