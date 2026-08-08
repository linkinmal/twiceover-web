#!/bin/bash
# Worktree reminder (SessionStart + PreToolUse Edit|Write, non-blocking).
# Ported from stock-analyst-platform's .claude/hooks/worktree-reminder.sh
# (ADR 0025 Amendments 1-3, stock-analyst-platform #123): every session
# working in this repo works in its own git worktree, never the shared main
# checkout. This repo is a sibling of stock-analyst-platform, not nested
# under it, so `EnterWorktree` cannot reach it — use `git worktree add`
# directly (see the fix message below). Fail-open by design: no jq, no git
# repo, no match -> exit 0 silently. Advisory only — the real gate is the
# blocking `.githooks/pre-commit` check (enable once per checkout:
# `git config core.hooksPath .githooks`).
#
# Detection: in a git worktree, `--git-dir` differs from `--git-common-dir`
# (the worktree's dir vs the shared .git). In the main/shared checkout
# they're equal. Fail-open: no git repo, no match -> exit 0 silently.
#
# ADR 0025 Amendment 8 (stock-analyst-platform #1961) ports Amendment 6's
# SessionStart fast-forward here. Measured 2026-08-08: this repo's shared
# checkout was 3 commits behind origin/main — the same unbounded-drift
# mechanism confirmed to have produced a false result in twiceover-app
# (QA #1347's repo-reader coverage survey read a 120-commit-stale checkout
# as missing components that exist on origin/main). Full rationale in
# ADR 0025 Amendment 6 (stock-analyst-platform).
#
# Safety, identical to the ported original: --ff-only can only ever move
# HEAD forward and refuses outright if the checkout has diverged or the
# merge would overwrite a modified/untracked tracked-path file — it can
# never discard another session's work. Every step is fail-open. Gated to
# SessionStart only (this script has no other event branching, so without
# the gate a fetch would run on every Edit/Write while parked in the
# shared checkout).

set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

input=$(cat 2>/dev/null || true)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null || true)

gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
commondir=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0

# Different dirs => already in an isolated worktree. Nothing to say.
[ "$gitdir" != "$commondir" ] && exit 0

refresh_note=""
if [ "$event" = "SessionStart" ] && [ "$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)" = "main" ]; then
  before=$(git rev-parse HEAD 2>/dev/null || true)
  if [ -n "$before" ] && git fetch origin main --quiet 2>/dev/null; then
    if git merge --ff-only --quiet origin/main 2>/dev/null; then
      after=$(git rev-parse HEAD 2>/dev/null || true)
      if [ -n "$after" ] && [ "$before" != "$after" ]; then
        pulled=$(git rev-list --count "${before}..${after}" 2>/dev/null || echo '?')
        refresh_note="
↻ Shared checkout was ${pulled} commit(s) behind and has been fast-forwarded to origin/main (ADR 0025 Amdt 8, stock-analyst-platform #1961). If this session's agent/skill registry was snapshotted before that, a persona or skill merged in those ${pulled} commits may be missing from it for this session only — restart the session if something the repo documents appears absent."
      fi
    fi
  fi
fi

msg="⚠ Shared checkout, not a worktree — ADR 0025 (stock-analyst-platform, Amendments 1-3) requires every session in this repo to work in its own git worktree.
This repo is a sibling of stock-analyst-platform, not nested under it, so EnterWorktree can't reach it. Run before any further Read/Edit/Write here:
  git worktree add ~/git/<repo>-wt/<role>-<issue-or-topic>-<slug> -b <role>/<issue-or-topic>-<slug> origin/main
A blocking pre-commit check backs this up (enable once per checkout: git config core.hooksPath .githooks) — but don't rely on it; isolate first.
Skipping this risks a non-fast-forward push and a merge conflict with another concurrent session's uncommitted work.${refresh_note}"

jq -n --arg m "$msg" '{systemMessage: $m}'
exit 0
