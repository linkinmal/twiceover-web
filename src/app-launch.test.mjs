import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPLE_PROVIDER_TOKEN,
  APP_COPY,
  APP_STORE_VARIANTS,
  BADGE_ART,
  DEFAULT_APP_STORES,
  STORE_CAMPAIGNS,
  appStoreUrl,
  assertBadgeArt,
  parseAppStores,
  playStoreUrl,
  storesFor,
} from "./app-launch.mjs";

describe("the site variant (app-launch-surfaces.md §2 Variants)", () => {
  it("defaults to the committed variant when SITE_APP_STORES is unset or empty", () => {
    expect.soft(parseAppStores(undefined)).toBe(DEFAULT_APP_STORES);
    expect.soft(parseAppStores("")).toBe(DEFAULT_APP_STORES);
    expect.soft(APP_STORE_VARIANTS).toContain(DEFAULT_APP_STORES);
  });

  it("refuses an unknown variant rather than guessing a store", () => {
    expect.soft(() => parseAppStores("ios")).toThrow(/both, iphone, android/);
    expect.soft(() => storesFor("all")).toThrow();
  });

  it("shows only the live stores: Apple first, a plain line under a lone badge, no banner without an iPhone app", () => {
    expect.soft(storesFor("both")).toEqual({ apple: true, play: true, comingSoon: null, smartAppBanner: true });
    expect
      .soft(storesFor("iphone"))
      .toEqual({ apple: true, play: false, comingSoon: "Android app coming soon.", smartAppBanner: true });
    expect
      .soft(storesFor("android"))
      .toEqual({ apple: false, play: true, comingSoon: "iPhone app coming soon.", smartAppBanner: false });
  });

  it("fails the build for a variant whose badge art is not committed, and passes once it is", () => {
    const dir = mkdtempSync(join(tmpdir(), "badges-"));
    mkdirSync(join(dir, "badges"));
    writeFileSync(join(dir, BADGE_ART.apple), "<svg/>");
    expect.soft(() => assertBadgeArt("iphone", dir)).not.toThrow();
    expect.soft(() => assertBadgeArt("both", dir)).toThrow(/google-play\.svg/);
    expect.soft(() => assertBadgeArt("android", dir)).toThrow(/google-play\.svg/);
    writeFileSync(join(dir, BADGE_ART.play), "<svg/>");
    expect.soft(() => assertBadgeArt("both", dir)).not.toThrow();
  });
});

// Verbatim from Growth's app-launch-kit.md §5 and the Designer's boards (consult 1178). A change here
// is a copy change in those documents first.
describe("the launch copy, verbatim", () => {
  it("carries Growth's strings", () => {
    expect.soft(APP_COPY.headline).toBe("Your book, your rules, on your phone.");
    expect
      .soft(APP_COPY.sub)
      .toBe("One account on your phone and the web, so your rules and your connected broker come with you.");
    expect.soft(APP_COPY.title).toBe("TwiceOver mobile app: your book, your rules");
    expect
      .soft(APP_COPY.description)
      .toBe("Your profit targets and loss limits, checked on the positions they fit. One account on your phone and the web.");
    expect
      .soft(APP_COPY.phoneCaptions.analysis)
      .toBe("Any US-listed stock's analysis, opening with its three projected prices");
    expect.soft(APP_COPY.blocks[1].heading).toBe("Any US-listed stock's analysis opens with three projected prices");
    expect.soft(APP_COPY.previewCaption).toBe("The same account on every screen.");
    expect
      .soft(APP_COPY.faq[2].a)
      .toBe(
        "Interactive Brokers, Schwab, Fidelity, Robinhood, E*Trade, tastytrade, Webull, Vanguard and more. You can connect from the app or from the web.",
      );
    expect
      .soft(APP_COPY.planAnswer.both)
      .toBe(
        "Yes. Sign in with the same email and your plan works on the web, iPhone and Android. Plans are sold on the web and in the iPhone app.",
      );
  });

  it("carries one link label across the product: Mobile app", () => {
    expect.soft(APP_COPY.navLabel).toBe("Mobile app");
    expect.soft(APP_COPY.heroLink).toBe("Get the mobile app →");
    expect.soft(APP_COPY.howPageLink).toBe("Or get the mobile app →");
    expect.soft(APP_COPY.blogEndLink).toBe("get the mobile app");
  });

  it("has a plan answer for every variant and four FAQ questions in all", () => {
    for (const v of APP_STORE_VARIANTS) expect.soft(APP_COPY.planAnswer[v]).toMatch(/^Yes\. /);
    expect.soft(APP_COPY.faq.length + 1).toBe(4);
  });
});

describe("the store badge links carry the placement's campaign (#4598, app-stores.md §3)", () => {
  it("tags the Play link with the referrer, URL-encoded once", () => {
    expect.soft(playStoreUrl(STORE_CAMPAIGNS.appPage)).toBe(
      "https://play.google.com/store/apps/details?id=io.twiceover.app&referrer=utm_source%3Dtwiceover.io%26utm_medium%3Dwebsite%26utm_campaign%3Dsite-app-page",
    );
    expect.soft(playStoreUrl(STORE_CAMPAIGNS.home)).toContain("utm_campaign%3Dsite-home");
  });

  it("tags the Apple link with the provider token, campaign and media type once the token is set", () => {
    expect.soft(appStoreUrl(STORE_CAMPAIGNS.home, "12345678")).toBe("https://apps.apple.com/app/id6804799140?pt=12345678&ct=site-home&mt=8");
    expect.soft(appStoreUrl(STORE_CAMPAIGNS.appPage, "")).toBe("https://apps.apple.com/app/id6804799140");
  });

  it("refuses a token that is not digits, so a '<pt>' placeholder cannot ship", () => {
    expect.soft(() => appStoreUrl(STORE_CAMPAIGNS.home, "<pt>")).toThrow(/digits/);
    expect.soft(APPLE_PROVIDER_TOKEN).toMatch(/^\d+$/);
  });

  it("tags the live Apple links with Growth's provider token, one campaign per placement", () => {
    expect.soft(APPLE_PROVIDER_TOKEN).toBe("129355732");
    expect.soft(appStoreUrl(STORE_CAMPAIGNS.appPage)).toBe("https://apps.apple.com/app/id6804799140?pt=129355732&ct=site-app-page&mt=8");
    expect.soft(appStoreUrl(STORE_CAMPAIGNS.home)).toBe("https://apps.apple.com/app/id6804799140?pt=129355732&ct=site-home&mt=8");
  });

  it("names the two placements' campaigns", () => {
    expect.soft(STORE_CAMPAIGNS).toEqual({ appPage: "site-app-page", home: "site-home" });
  });
});
