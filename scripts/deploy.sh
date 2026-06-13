#!/usr/bin/env bash
#
# Guarded deploy for the TwiceOver pre-launch site (#69, within ADR 0002).
# The one driveable deploy command — `npm run deploy` → this script.
#
# Deploy stays human-triggered behind the gated flow (green CI → Architect review →
# human approval → merge/deploy). This automates the credential bridge and the
# pre-upload gates; it does NOT auto-deploy.
#
# Pipeline:
#   1. Build + content gate (AC3 banned terms, AC4 disclaimer byte-identical).
#   2. Consultation-0008 log gate (Security, CLOSED + re-verified 2026-06-13).
#   3. Inject the Cloudflare token for this one invocation (env-var override,
#      macOS Keychain fallback) — never echoed.
#   4. wrangler deploy.
#
set -euo pipefail
cd "$(dirname "$0")/.."

# ── 1 · Build + content gate (AC3/AC4) ──────────────────────────────────────
echo "▸ Build…"
npm run build
echo "▸ Content gate (AC3 banned terms · AC4 disclaimer byte-identical)…"
node ci/check-content.mjs

# ── 2 · Consultation-0008 log gate ──────────────────────────────────────────
# Security's "no operator-accessible access/edge logs" posture (consultation 0008,
# CLOSED + re-verified against the live deploy 2026-06-13) rests on two legs:
#   (a) the zone staying on Cloudflare's Free plan — raw per-request/IP logs
#       (Logpush / Logs Engine) are Enterprise-only, so a Free-plan operator
#       cannot provision or access them. Account-side; Security verifies it live.
#   (b) Workers observability staying OFF — no Workers Logs collected. This leg
#       lives in this repo, so assert it here: a deploy must not silently enable
#       observability and invalidate the /privacy "collects no personal
#       information" line (which would then need softening per 0008).
if node -e '
  const src = require("fs").readFileSync("wrangler.jsonc", "utf8").replace(/\/\/[^\n]*/g, "");
  const on = /"observability"\s*:\s*\{[^}]*"enabled"\s*:\s*true/s.test(src);
  process.exit(on ? 1 : 0);
'; then
  echo "▸ 0008 gate: Workers observability off — no operator-accessible logs (consultation 0008)."
else
  echo "✗ 0008 gate: wrangler.jsonc enables Workers observability." >&2
  echo "  That collects operator-accessible logs and makes the /privacy \"collects no" >&2
  echo "  personal information\" line over-claim. Keep observability off, or soften" >&2
  echo "  /privacy per consultation 0008, before deploying." >&2
  exit 1
fi

# ── 3 · Token: env-var override, Keychain fallback (never echoed) ────────────
# CI can export CLOUDFLARE_API_TOKEN (a secret) to override; otherwise the macOS
# Keychain item is the source on the single deploy machine. The := seam is where
# CD-on-merge would later plug a GitHub Actions secret (its own Architect ADR).
: "${CLOUDFLARE_API_TOKEN:=$(security find-generic-password -s cloudflare-api-token-twiceover -w 2>/dev/null || true)}"
export CLOUDFLARE_API_TOKEN
if [ -z "${CLOUDFLARE_API_TOKEN}" ]; then
  echo "✗ No Cloudflare token: set CLOUDFLARE_API_TOKEN, or store it in the macOS" >&2
  echo "  Keychain as generic password 'cloudflare-api-token-twiceover'." >&2
  exit 1
fi

# ── 4 · Deploy ───────────────────────────────────────────────────────────────
echo "▸ Deploying to Cloudflare (twiceover.io)…"
npx wrangler deploy
