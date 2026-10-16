/**
 * Consultation-0008 log gate (Security, CLOSED + re-verified 2026-06-13). Moved here from scripts/deploy.sh so the
 * verify job runs it with every other gate (ADR 1127 Decision 3).
 *
 * Security's "no operator-accessible access/edge logs" posture rests on two legs:
 *   (a) the zone staying on Cloudflare's Free plan — raw per-request/IP logs (Logpush / Logs Engine) are
 *       Enterprise-only, so a Free-plan operator cannot provision or access them. Account-side; Security verifies it.
 *   (b) Workers observability staying OFF — no Workers Logs collected. This leg lives in this repo, so it is asserted
 *       here: a deploy must not silently enable observability and invalidate the /privacy "collects no personal
 *       information" line (which would then need softening per 0008).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** True when the wrangler config, line comments removed, enables Workers observability. */
export function observabilityOn(jsonc) {
  const src = jsonc.replace(/\/\/[^\n]*/g, "");
  return /"observability"\s*:\s*\{[^}]*"enabled"\s*:\s*true/s.test(src);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  if (observabilityOn(readFileSync(join(root, "wrangler.jsonc"), "utf8"))) {
    console.error("✗ 0008 gate: wrangler.jsonc enables Workers observability.");
    console.error('  That collects operator-accessible logs and makes the /privacy "collects no');
    console.error('  personal information" line over-claim. Keep observability off, or soften');
    console.error("  /privacy per consultation 0008, before deploying.");
    process.exit(1);
  }
  console.log("▸ 0008 gate: Workers observability off — no operator-accessible logs (consultation 0008).");
}
