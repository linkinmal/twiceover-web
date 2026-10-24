// #4502 (#2521 founder sign-off 2026-10-24): /cookies names both cookies it sets and carries no pre-launch
// hedge; /refunds drops the internal-process sentence. /in-app/cookies renders the same page.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(root, f), "utf8");
const cookies = read("cookies.astro");
const refunds = read("refunds.astro");
const inApp = read("in-app/cookies.astro");

describe("the cookie policy (#4502)", () => {
  it("names the two first-party cookies and says no analytics or advertising cookies are set", () => {
    expect.soft(cookies).toContain("TwiceOver sets two cookies, both first-party and both only to run the service. A sign-in cookie keeps you signed in. A quota cookie counts your analyses against the free monthly allowance. It holds a random identifier that is not derived from your IP address or your account, and it lasts about 13 months. We set no analytics or advertising cookies.");
    expect.soft(cookies).toContain("We show no cookie-consent banner because those two cookies are the only ones we set, and neither is for analytics or advertising.");
    expect.soft(cookies).toContain('description="Which cookies twiceover.io sets, why, and how to control them — two first-party cookies, no advertising or analytics tracking."');
    expect.soft(cookies).toContain("you should instruct your browser to refuse cookies from https://twiceover.io");
  });

  it("no longer carries the pre-launch note or the strictly-necessary hedge", () => {
    expect.soft(cookies).not.toContain("Pre-launch note");
    expect.soft(cookies).not.toContain("(if any)");
    expect.soft(cookies).not.toMatch(/strictly-necessary/i);
  });

  it("is what /in-app/cookies renders, without chrome", () => {
    expect.soft(inApp).toContain('import Page from "../cookies.astro"');
    expect.soft(inApp).toContain('<Page chrome="none" />');
  });
});

describe("the refund policy (#4502)", () => {
  it("drops the prior-promise sentence and keeps the rest of the Refund requests bullet", () => {
    expect.soft(refunds).not.toContain("real change from TwiceOver's own prior promise");
    expect.soft(refunds).not.toContain("a true MoR");
    expect.soft(refunds).toContain("contact Dodo within 60 days of your purchase.</li>");
    expect.soft(refunds).toContain("at Dodo's sole discretion, on a case-by-case basis, and may be refused");
  });
});
