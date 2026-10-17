#!/usr/bin/env bash
#
# Deploy for the TwiceOver pre-launch site (#69, within ADR 0002). `npm run deploy` → this script.
#
# Production deploys run from CI on `main` only (push, the daily schedule, or a manual dispatch; see
# .github/workflows/ci.yml). This script ships the dist/ that is already in place: the `deploy` job downloads the
# artifact `build-and-check` built and `verify` checked, and confirms its digest, before it runs this. It builds
# nothing and runs no gate — `verify` is the one gate list (ADR 1127 Decision 3, Security consult 1125). The token
# comes only from the environment of the one CI step that runs this; there is no local fallback. The way back from a
# bad deploy is `wrangler rollback` (a re-run of the workflow redeploys only the head of main).
set -euo pipefail
cd "$(dirname "$0")/.."

# A set BLOG_NOW moves the blog's clock (pull-request builds set it far ahead so every post is built and checked).
# This script builds nothing, so the control is build-and-check's env in ci.yml; a BLOG_NOW here means something set
# it where a deploy runs, and the deploy refuses as a backstop (ADR 1090, Security 1091).
if [ -n "${BLOG_NOW:-}" ]; then
  echo "BLOG_NOW is set (${BLOG_NOW}); a deploy must use the real clock. Refusing." >&2
  exit 1
fi

# A set BLOG_CONTENT_DIR points a build at another folder of posts (the fixture build). The same backstop.
if [ -n "${BLOG_CONTENT_DIR:-}" ]; then
  echo "BLOG_CONTENT_DIR is set (${BLOG_CONTENT_DIR}); a deploy must publish the posts in src/content/blog. Refusing." >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is not set; the deploy step's environment supplies it. Refusing." >&2
  exit 1
fi

echo "▸ Deploying to Cloudflare (twiceover.io)…"
npx wrangler deploy
