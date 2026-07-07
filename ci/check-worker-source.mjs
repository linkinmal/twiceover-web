#!/usr/bin/env node
/**
 * Deploy gate for the SITE_METRICS Worker (ADR 0136 / consult 0163, #557).
 *
 * twiceover-web has no TypeScript build/type-check step, so the app-repo's type-level
 * "uninhabitable field" mechanism (RejectedTelemetryField) isn't available here. This is
 * the right-sized equivalent Security scoped in consult 0163: a source-text assertion in
 * the same regex-over-source idiom deploy.sh / ci/check-content.mjs already use, run as a
 * fail-closed gate before every deploy. It keeps the Worker source *incapable of
 * referencing* per-request identifying data as the code evolves — a stronger invariant
 * than only disabling the observability sink.
 *
 * Three parts (consult 0163 §2):
 *   1. Denylist  — no IP/UA/cookie header, no full-header enumeration, no hash/crypto.
 *   2. Allowlist — every writeDataPoint blobs array is exactly the closed six-field set.
 *   3. console.* — no console call may reference request/headers/cf (leak on tail or if
 *      observability is ever turned on).
 *
 * Trip-wire (consult 0163): a 7th field, any header beyond cf.country, a cookie, or a
 * third-party processor reopens the Security thread — this gate blocks (a) and (b) at
 * source. Scans worker/**.js (excluding *.test.js).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = join(root, "worker");

// The exhaustive, closed six-field set ADR 0136 commits to. The order matters — it is the
// positional blobs contract writeDataPoint emits.
const ALLOWED_FIELDS = ["path", "referrer", "utm_source", "utm_medium", "utm_campaign", "country"];

// (1) Denylist — case-insensitive substrings that must never appear in Worker source.
const DENY = [
  // Per-request identifying headers.
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
  "true-client-ip",
  "user-agent",
  "cookie", // also matches set-cookie
  // Full-header-enumeration idioms (would capture the whole request surface).
  "headers.entries(",
  "headers.forEach(",
  "...request.headers",
  "object.fromentries(request.headers",
  // Hash / crypto primitives — a *hashed* IP is still personal data (ADR 0131). Block the
  // "just hash it" reach, not only raw capture.
  "crypto.subtle",
  "sha256",
  "sha-256",
  "hmac",
  ".digest(",
];

function workerFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...workerFiles(p));
    else if (entry.endsWith(".js") && !entry.endsWith(".test.js")) out.push(p);
  }
  return out;
}

/** Strip line + block comments so a comment mentioning a banned token isn't a false positive. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

const failures = [];
let files;
try {
  files = workerFiles(workerDir);
} catch {
  console.error("FATAL: worker/ not found.");
  process.exit(1);
}
if (files.length === 0) failures.push("[structure] no Worker source found under worker/");

for (const file of files) {
  const rel = relative(root, file);
  const code = stripComments(readFileSync(file, "utf8"));
  const lower = code.toLowerCase();

  // (1) Denylist.
  for (const token of DENY) {
    if (lower.includes(token)) {
      failures.push(`[denylist] ${rel}: banned token "${token}" — no IP/UA/cookie/header-dump/hash in Worker source.`);
    }
  }

  // (2) Allowlist — every writeDataPoint blobs array is exactly the six fields, in order.
  const wdp = [...code.matchAll(/writeDataPoint\s*\(\s*\{([\s\S]*?)\}\s*\)/g)];
  if (files.length === 1 && wdp.length === 0 && /writeDataPoint/.test(code)) {
    failures.push(`[allowlist] ${rel}: writeDataPoint call present but its argument object could not be parsed.`);
  }
  for (const call of wdp) {
    const body = call[1];
    const blobsMatch = body.match(/blobs\s*:\s*\[([^\]]*)\]/);
    if (!blobsMatch) {
      failures.push(`[allowlist] ${rel}: writeDataPoint call has no blobs array.`);
      continue;
    }
    const blobs = blobsMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(blobs) !== JSON.stringify(ALLOWED_FIELDS)) {
      failures.push(
        `[allowlist] ${rel}: writeDataPoint blobs [${blobs.join(", ")}] must be exactly [${ALLOWED_FIELDS.join(", ")}].`,
      );
    }
    // indexes may only sample on an allowed field.
    const indexesMatch = body.match(/indexes\s*:\s*\[([^\]]*)\]/);
    if (indexesMatch) {
      const idx = indexesMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const key of idx) {
        if (!ALLOWED_FIELDS.includes(key)) {
          failures.push(`[allowlist] ${rel}: writeDataPoint index "${key}" is outside the six-field set.`);
        }
      }
    }
    // No numeric identifier smuggled through doubles.
    if (/doubles\s*:/.test(body)) {
      failures.push(`[allowlist] ${rel}: writeDataPoint uses "doubles" — SITE_METRICS emits only the six string fields.`);
    }
  }

  // (3) console.* coverage — no console call may reference the request, its headers, or cf.
  for (const m of code.matchAll(/console\.\w+\s*\(([^)]*)\)/g)) {
    const args = m[1].toLowerCase();
    if (/\brequest\b|\bheaders\b|\.cf\b|\breq\b/.test(args)) {
      failures.push(`[console] ${rel}: console call references request/headers/cf — could leak per-request data.`);
    }
  }
}

if (failures.length) {
  console.error("✗ Worker source gate FAILED (ADR 0136 / consult 0163):\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} violation(s). SITE_METRICS must emit only {${ALLOWED_FIELDS.join(", ")}} and read no IP/header/identifier.`);
  process.exit(1);
}
console.log(`▸ Worker source gate: ${files.length} file(s) clean — six-field allowlist, no IP/header/hash, no console leak (consult 0163).`);
