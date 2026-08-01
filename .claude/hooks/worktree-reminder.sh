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

set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
commondir=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0

# Different dirs => already in an isolated worktree. Nothing to say.
[ "$gitdir" != "$commondir" ] && exit 0

msg="⚠ Shared checkout, not a worktree — ADR 0025 (stock-analyst-platform, Amendments 1-3) requires every session in this repo to work in its own git worktree.
This repo is a sibling of stock-analyst-platform, not nested under it, so EnterWorktree can't reach it. Run before any further Read/Edit/Write here:
  git worktree add ~/git/<repo>-wt/<role>-<issue-or-topic>-<slug> -b <role>/<issue-or-topic>-<slug> origin/main
A blocking pre-commit check backs this up (enable once per checkout: git config core.hooksPath .githooks) — but don't rely on it; isolate first.
Skipping this risks a non-fast-forward push and a merge conflict with another concurrent session's uncommitted work."

jq -n --arg m "$msg" '{systemMessage: $m}'
exit 0
