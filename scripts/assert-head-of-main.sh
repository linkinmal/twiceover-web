#!/usr/bin/env bash
#
# The deploy runs only the code that is at the head of `main` (ADR 1090 Decision 3; Security consult 1091).
# A re-run of an old workflow run, or a run that a newer merge has overtaken, carries an old GITHUB_SHA;
# deploying it would put old content over the new. So before `npm run deploy` the run's SHA must equal the
# remote head of main, read fresh from the remote. It fails loudly rather than skipping: a "successful" run
# that deployed nothing would read as a deploy.
#
# usage: assert-head-of-main.sh [remote]   (default: origin)   env: GITHUB_SHA
set -euo pipefail

remote="${1:-origin}"

if [ -z "${GITHUB_SHA:-}" ]; then
  echo "GITHUB_SHA is not set; cannot tell which commit this run is. Refusing." >&2
  exit 1
fi

head="$(git ls-remote "$remote" refs/heads/main | cut -f1)"
if [ -z "$head" ]; then
  echo "Could not read the head of main from '$remote'. Refusing." >&2
  exit 1
fi

if [ "$head" != "$GITHUB_SHA" ]; then
  echo "This run is for ${GITHUB_SHA}, but main is now at ${head}. A deploy ships the head of main only. Refusing." >&2
  exit 1
fi

echo "▸ ${GITHUB_SHA} is the head of main."
