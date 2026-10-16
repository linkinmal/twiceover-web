/**
 * /delete-account (stock-analyst-platform#4202) — the page Play's Data safety form points at.
 * Source-level, like the other page tests. Pins what the page must say (Security's requirements on
 * #4202) and what keeps it inside the sealed site: no script, no form, nothing but mailto: and
 * same-origin links off it. Control: the same scan must find the /privacy link it expects.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const page = read("src/pages/delete-account.astro");
const privacy = read("src/pages/privacy.astro");
const text = page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("delete-account page", () => {
  it("names the app, developer, in-app path, email route and every disposition", () => {
    expect(page).toContain("io.twiceover.app");
    expect(page).toContain("{ENTITY}");
    for (const label of ["Account", "Settings", "Data &amp; privacy", "Delete account…", "DELETE", "6-digit code"]) {
      expect(page).toContain(label);
    }
    expect(page).toContain("mailto:${EMAIL}");
    for (const id of ["deleted", "anonymized", "retained", "subscriptions", "timing"]) {
      expect(page).toContain(`id="${id}"`);
    }
    expect(text).toMatch(/does not cancel the subscription/);
    expect(text).toMatch(/SnapTrade/);
    expect(text).toMatch(/Dodo Payments/);
  });

  it("states the same 30-day outer bound the Privacy Policy does", () => {
    expect(privacy).toContain("within 30 days of the deletion of your account");
    expect(text).toContain("within 30 days of the deletion of your account");
  });

  it("carries no script, form, or off-site link", () => {
    expect(page).not.toMatch(/<script|<form|<input|<iframe/i);
    const hrefs = [...page.matchAll(/href=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);
    expect(hrefs).toContain("/privacy"); // control: the scan sees links
    for (const h of hrefs) expect(h).toMatch(/^(\/privacy|mailto:\$\{EMAIL\})$/);
  });
});
