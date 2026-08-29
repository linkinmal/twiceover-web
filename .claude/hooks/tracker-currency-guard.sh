#!/bin/bash
# Tracker currency guard (PreToolUse on Bash, BLOCKING). ADR 0803, #2928.
#
# WHAT THIS CLOSES. A role's picture of the tracker is a snapshot taken at
# gather-facts (ADR 0032 A16), and its accuracy decays for the entire length
# of the session — measured at ~4.3 issue-closes per active tracker-hour
# (#2928 fact pack). CLAUDE.md's currency rule ("Blocking assertions must be
# current and in-scope") and the consult skill's "refresh currency" step
# both say the right thing and both have no reader: nothing stops a `gh`
# write that acts on a stale picture. This hook is that reader, for the two
# failure shapes that are writes (a third, misreporting status in chat with
# no tool call, has no interceptable surface and is not addressed here).
#
# TWO PATTERNS BLOCKED, both via a LIVE re-check (a fresh `gh api` call made
# at the moment of the write, never a cached/remembered state):
#   1. Direct write to a currently-closed issue: `gh issue comment|close|edit
#      <N>` (or the raw REST equivalents) where #N's live state is closed.
#   2. A citation inside the command text that asserts a currently-closed
#      issue is open/blocking/unstarted — CLAUDE.md's "blocked-by #N" case
#      and #2928's own failure 2 (a comment on #2924 citing #2923, already
#      closed, as an "open gap").
#
# `gh issue reopen` is NEVER matched or blocked — it is the correct fix for
# a premature close (#2928's data has one: #2294 on #19/#28), and because
# the check is a live re-fetch rather than a memory, a role that reopens
# #N and then writes to it sails through cleanly: by the time the write's
# own check runs, #N really is open again. This hook has no state of its
# own to go stale.
#
# SCOPE. Only `gh issue` shapes (comment/close/edit) and their `gh api
# repos/.../issues/<N>` REST equivalents — the shapes #2928 names. Not `gh
# pr` (PRs live in twiceover-app/twiceover-web, a different repo from the
# tracker; a PR-state guard is a separate, not-yet-scoped question — To
# revisit, ADR 0803). Not board.mjs (a Status flip, not a claim about
# open/closed). Citation-scan is best-effort text matching over the
# command's own inline `--body`/`-f body=`/`-F body=` text; a `--body-file`
# argument is read from disk if the path resolves, skipped otherwise — the
# PRIMARY guarantee is the direct-target check, which every write shape
# reaches regardless of body content.
#
# COST. A prefilter (`gh issue` substring) means the overwhelming majority
# of Bash calls never reach a `gh api` round-trip at all. When a match
# fires, live-state checks are REST (`gh api repos/.../issues/<N>`, not
# GraphQL) — a quota this repo's hooks don't otherwise contend for (see
# tracker-driving-cheatsheet memory: item-list is the expensive one, REST
# item reads are cheap). Citation numbers checked are capped at 8 per call
# to bound a pathological comment; if more than 8 matched, the block/allow
# message says so rather than silently under-checking (constitution: "No
# silent caps").
#
# FAILS OPEN throughout, same posture as every other hook in this repo:
# missing jq, missing gh, unparseable JSON, an unresolvable repo, or a
# failed/errored `gh api` call for a given number all skip that number
# rather than deny — a false ALLOW here degrades to the pre-existing risk
# this hook closes (not a new one); a false DENY would stall a session on a
# condition it cannot clear.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0
command -v gh >/dev/null 2>&1 || exit 0

input=$(cat 2>/dev/null || true)
[ -n "$input" ] || exit 0

jqr() { printf '%s' "$input" | jq -r "$1" 2>/dev/null || true; }

tool_name=$(jqr '.tool_name // empty')
[ "$tool_name" = "Bash" ] || exit 0

cmd=$(jqr '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0

# Cheap prefilter — the overwhelming majority of Bash calls never touch a
# tracker `gh issue` write at all.
case "$cmd" in
  *"gh issue"*|*"gh api"*"/issues/"*) ;;
  *) exit 0 ;;
esac

# `gh issue reopen` is never matched, on any line of a multi-command string.
if printf '%s' "$cmd" | grep -qE 'gh[[:space:]]+issue[[:space:]]+reopen'; then
  exit 0
fi

# Resolve owner/repo: explicit --repo flag > gh api path > this repo's own
# tracker default (CLAUDE.md: "the single issue tracker... for every repo"
# is always linkinmal/stock-analyst-platform, per tools/board.mjs's own
# OWNER/REPO constants).
repo=$(printf '%s' "$cmd" | grep -oE -- '--repo[[:space:]]+[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' | head -1 | awk '{print $2}')
if [ -z "$repo" ]; then
  repo=$(printf '%s' "$cmd" | grep -oE 'repos/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/issues' | head -1 | sed -E 's#^repos/##; s#/issues$##')
fi
[ -n "$repo" ] || repo="linkinmal/stock-analyst-platform"

# ---- direct write target -----------------------------------------------
direct_n=""
direct_verb=""
if m=$(printf '%s' "$cmd" | grep -oE 'gh[[:space:]]+issue[[:space:]]+(comment|close|edit)[[:space:]]+[0-9]+' | head -1); then
  direct_verb=$(printf '%s' "$m" | awk '{print $3}')
  direct_n=$(printf '%s' "$m" | grep -oE '[0-9]+$')
elif m=$(printf '%s' "$cmd" | grep -oE 'issues/[0-9]+/comments' | head -1); then
  direct_verb="comment"
  direct_n=$(printf '%s' "$m" | grep -oE '[0-9]+')
elif m=$(printf '%s' "$cmd" | grep -oE 'issues/[0-9]+([^/0-9][^[:space:]]*)?[[:space:]]+.*-X[[:space:]]+PATCH' | head -1); then
  direct_verb="edit"
  direct_n=$(printf '%s' "$m" | grep -oE '[0-9]+' | head -1)
fi

# ---- citation scan (best-effort, over inline body text + body-file) ----
body=""
if b=$(printf '%s' "$cmd" | grep -oE -- '(--body|-f[[:space:]]+body=|-F[[:space:]]+body=)[[:space:]]*"[^"]*"'); then
  body="$b"
fi
bf=$(printf '%s' "$cmd" | grep -oE -- '(--body-file|-f[[:space:]]+body=@|-F[[:space:]]+body=@)[[:space:]]*[^[:space:]"]+' | head -1 | sed -E 's/^[^@]*@?//' | awk '{print $NF}')
if [ -n "$bf" ] && [ -f "$bf" ]; then
  body="$body $(cat "$bf" 2>/dev/null || true)"
fi
scan_text="$cmd $body"

citations=""
extract() {
  printf '%s' "$scan_text" | grep -oE "$1" 2>/dev/null | grep -oE '[0-9]+'
}
citations="$citations $(extract 'blocked[-[:space:]]by:?[[:space:]]*#[0-9]+')"
citations="$citations $(extract '#[0-9]+[^.]{0,40}(is|remains|stays|still)[[:space:]]+open')"
citations="$citations $(extract '#[0-9]+[^.]{0,40}(unstarted|not yet started|untouched|unruled)')"
citations=$(printf '%s\n' $citations | grep -E '^[0-9]+$' | sort -un)

capped=0
all_numbers="$direct_n"
count=0
checked_citations=""
for n in $citations; do
  [ "$n" = "$direct_n" ] && continue
  count=$((count + 1))
  if [ "$count" -gt 8 ]; then capped=1; break; fi
  checked_citations="$checked_citations $n"
done
all_numbers="$all_numbers $checked_citations"
all_numbers=$(printf '%s\n' $all_numbers | grep -E '^[0-9]+$' | sort -un)
[ -n "$all_numbers" ] || exit 0

stale=""
for n in $all_numbers; do
  st=$(gh api "repos/${repo}/issues/${n}" --jq '.state + "|" + (.closed_at // "unknown")' 2>/dev/null) || continue
  [ -n "$st" ] || continue
  state="${st%%|*}"
  closed_at="${st#*|}"
  if [ "$state" = "closed" ]; then
    stale="${stale}#${n} (closed ${closed_at}); "
  fi
done
[ -n "$stale" ] || exit 0

direct_stale=0
if [ -n "$direct_n" ] && printf '%s' "$stale" | grep -q "#${direct_n} "; then
  direct_stale=1
fi

cap_note=""
[ "$capped" = "1" ] && cap_note=" (citation scan capped at 8 numbers; some later citations in this command were not checked.)"

if [ "$direct_stale" = "1" ]; then
  reason="ADR 0803 / #2928 — live re-check just now: issue ${stale% } is CLOSED, and this command's own target (\`gh issue ${direct_verb} ${direct_n}\`) writes to it. A stale picture of the tracker is the exact failure this guard closes — re-read #${direct_n}'s current state before writing.

If you intend to REOPEN it, run \`gh issue reopen ${direct_n}\` first — this exact call will then pass, because the check is a live fetch, not a memory.${cap_note}"
else
  reason="ADR 0803 / #2928 — live re-check just now: this command's text cites ${stale% } as open/blocking/unstarted, but it is CLOSED. CLAUDE.md's currency rule (\"Blocking assertions must be current and in-scope\") applies here — refresh against the issue's current state before citing it.${cap_note}"
fi

jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
exit 0
