// The app launch surfaces, held against the built pages for the variant that was built
// (app-launch-surfaces.md §2–§4, stock-analyst-platform#4598). Pure: `check-app-launch.mjs` walks
// dist/ and hands the pages here; `app-launch-rules.test.mjs` holds each rule to a page that breaks it.
import { APP_COPY, storesFor } from "../src/app-launch.mjs";

const count = (html, re) => (html.match(re) ?? []).length;
const BANNER = /<meta name="apple-itunes-app" content="app-id=6804799140">/g;
const BADGE = (store) => new RegExp(`data-store-badge="${store}"`, "g");
const QR = /class="app-qr__code"/g;
const NAV_APP = /<a class="site-nav__app" href="\/app"/g;
const FOOTER_APP = /<nav class="footer-links"[^]*?<a href="\/app">Mobile app<\/a>/;

// Pages that carry the badges and the QR, and how many sets each draws.
const BADGE_PAGES = { "index.html": 1, "app/index.html": 2 };
const HOW_PAGES = ["how-our-analysis-works/index.html", "your-portfolio/index.html"];
const PRICING = "pricing/index.html";
const MOR_LINE = /<p class="mor-line">([^]*?)<\/p>/g;

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
    if (sets) {
      // The plain line under a lone badge names the other store; both stores, no line.
      const lines = count(html, /<p class="store-badges__next">([^<]*)<\/p>/g);
      const right = want.comingSoon ? count(html, new RegExp(`<p class="store-badges__next">${want.comingSoon}</p>`, "g")) : 0;
      if (lines !== (want.comingSoon ? sets : 0) || right !== lines) {
        fail(rel, `expected ${want.comingSoon ? `${sets} "${want.comingSoon}" line(s)` : "no coming-soon line"} in the "${variant}" variant`);
      }
    }
    if (rel === "privacy/index.html") {
      // Dodo is the processor for web purchases only; an iPhone buyer is billed by Apple (ADR 1018).
      for (const [needle, what] of [
        ["handling of subscriptions bought on the web.</li>", "Dodo scoped to web subscriptions"],
        ["If you subscribe in the iPhone app, Apple is the seller.", "the Apple seller sentence"],
        ["for web purchases, card and billing details are handled by", "the card sentence scoped to web purchases"],
      ]) {
        if (!html.includes(needle)) fail(rel, `the privacy policy lacks ${what}`);
      }
    }
    if (rel === "index.html") {
      // One string, in the description, og:description and twitter:description, per variant.
      for (const tag of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
        if (!html.includes(`<meta ${tag} content="${APP_COPY.homeDescription[variant].replaceAll("'", "&#39;")}"`) && !html.includes(`<meta ${tag} content="${APP_COPY.homeDescription[variant]}"`)) {
          fail(rel, `${tag} is not the "${variant}" variant's homepage description`);
        }
      }
      // The cancel answer is scoped to the web, with the iPhone sentence only where that app is live.
      const answer = `<p>${APP_COPY.cancelWebHtml}${want.apple ? ` ${APP_COPY.cancelIphone}` : ""}</p>`;
      if (!html.includes(answer)) fail(rel, `the "How do I cancel?" answer is not the "${variant}" variant's web-scoped one`);
    }
    if (rel === "app/index.html" && !html.includes(APP_COPY.planAnswer[variant])) {
      fail(rel, `the plan answer is not the "${variant}" variant's`);
    }

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
  if (PRICING in pages) failures.push(...pricingFailures(pages[PRICING], variant));
  for (const rel of [...Object.keys(BADGE_PAGES), ...HOW_PAGES, PRICING, "privacy/index.html"]) {
    if (!(rel in pages)) fail(rel, "page missing from the build");
  }
  // Control: with posts to build, at least one was checked, or the post-end rule matched nothing.
  if (postSlugs.length && !Object.keys(pages).some((rel) => isPost(rel, postSlugs))) {
    fail("blog/", "no built post page matched a post slug: the post-end link rule checked nothing");
  }
  return failures;
}

// S7 (app-launch-kit.md §5; Designer ruling, stock-analyst-platform#4598): the Pricing page's one plain
// line under the merchant-of-record paragraph and above "What each plan includes" — text only, so no
// link, button, badge or QR. It names a store only where that app is live, and "Android" never shares
// a sentence with a sale word.
function pricingFailures(html, variant) {
  const out = [];
  const fail = (msg) => out.push(`[APP] ${PRICING}: ${msg}`);
  const lines = [...html.matchAll(MOR_LINE)].map((m) => m[1]);
  if (lines[0] !== APP_COPY.morLineHtml) fail("the merchant-of-record line is not the web-scoped one");
  const line = lines[1];
  if (line === undefined) return [`[APP] ${PRICING}: no app line under the merchant-of-record line`];
  if (line !== APP_COPY.pricingLine[variant]) fail(`the app line is not the "${variant}" variant's, as plain text`);
  const at = html.indexOf(line);
  const plans = html.indexOf('id="plans-title"');
  if (plans === -1 || at > plans) fail('the app line does not sit before "What each plan includes"');
  if (variant === "iphone" && /android/i.test(line)) fail("the iPhone-only variant names Android");
  if (variant === "android" && /iphone/i.test(line)) fail("the Android-only variant names iPhone");
  for (const sentence of line.split(/(?<=\.)\s+/)) {
    if (/android/i.test(sentence) && /\b(buy|subscribe)/i.test(sentence)) {
      fail(`"${sentence}" puts Android beside buy or subscribe`);
    }
  }
  return out;
}
