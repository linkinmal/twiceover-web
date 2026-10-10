/**
 * A deploy never runs on a moved blog clock (ADR 1090 Decision 4; Security consult 1091). Pull requests
 * set BLOG_NOW far ahead so every post is built; if that reached a deploy, future posts would go live.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// deploy.sh is a REAL deploy (a test of this once shipped a branch to production). So it runs here only
// with BLOG_NOW set, with no HOME (no Keychain), and with a PATH whose first entry holds fake `npm`,
// `npx`, `node`, `wrangler` and `security` that record themselves and exit 99: if the guard were ever
// removed, the script would hit a fake and the test would say which one ran.
function runGuarded() {
  const bin = mkdtempSync(join(tmpdir(), "deploy-guard-"));
  const ran = join(bin, "ran.log");
  for (const name of ["npm", "npx", "node", "wrangler", "security"]) {
    const f = join(bin, name);
    writeFileSync(f, `#!/bin/sh\necho ${name} >> "${ran}"\nexit 99\n`);
    chmodSync(f, 0o755);
  }
  const r = spawnSync("/bin/bash", ["scripts/deploy.sh"], { env: { PATH: `${bin}:/usr/bin:/bin`, BLOG_NOW: "2100-01-01T00:00:00Z" }, encoding: "utf8", timeout: 20000 });
  return { ...r, ran: existsSync(ran) };
}

describe("scripts/deploy.sh", () => {
  it("refuses to run with BLOG_NOW set, before it builds, runs any gate or reads a credential", () => {
    const r = runGuarded();
    expect.soft(r.status).toBe(1);
    expect.soft(r.stderr).toContain("BLOG_NOW is set");
    expect.soft(r.ran, "no npm, npx, node, wrangler or security was started").toBe(false);
  });
});

describe(".github/workflows/ci.yml", () => {
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const [buildJob, deployJob] = ci.split(/\n  deploy:/);

  it("sets BLOG_NOW in the checking job only for a pull request, and never in the deploy job", () => {
    expect.soft(buildJob).toMatch(/BLOG_NOW: \$\{\{ github\.event_name == 'pull_request' && '2100-01-01T00:00:00Z' \|\| '' \}\}/);
    expect.soft(deployJob).toBeDefined();
    expect.soft(deployJob).not.toContain("BLOG_NOW");
  });
});
