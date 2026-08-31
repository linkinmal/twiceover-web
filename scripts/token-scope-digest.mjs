#!/usr/bin/env node
/**
 * Scoped digest over tokens/twiceover.tokens.json for the cross-repo byte-identity check with
 * stock-analyst-platform (stock-analyst-platform#2991, Designer role-gate verdict on this repo's
 * PR #67).
 *
 * The original check hashed the WHOLE file. That broke the moment this repo forked four groups away
 * from canonical on purpose: ADR 0340's Studio retone (`bg.canvas` both themes, `text.muted` light,
 * `border.interactive` light, `surface.panel` both themes) explicitly left twiceover-web's adoption
 * to consult 0341 (Designer -> Growth), still Open. A whole-file digest would go red on every future
 * canonical edit to those groups for a reason that isn't drift, training whoever hits it to reach
 * for --no-verify — exactly the failure mode this check exists to prevent, one layer up.
 *
 * So: hash the file with the forked leaves DELETED first, over both repos' copies. Two files that
 * agree everywhere else, and deliberately disagree only at the forked leaves, produce the SAME
 * scoped digest — which is what "byte-identical except where we said so" has to mean.
 *
 * FORKED_PATHS must stay in lockstep with stock-analyst-platform's tools/token-scope-digest.mjs —
 * same list, same stableStringify. If the two drift, both sides' digests stop agreeing and BOTH go
 * red, which fails closed rather than silently trusting a mismatch (there is no cross-repo import to
 * keep them in sync any other way).
 *
 * Usage: node scripts/token-scope-digest.mjs <path-to-tokens.json>   -> prints the hex digest
 *        node scripts/token-scope-digest.mjs -    (reads JSON from stdin instead)
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const FORKED_PATHS = [
  ['themes', 'light', 'bg', 'canvas'],
  ['themes', 'dark', 'bg', 'canvas'],
  ['themes', 'light', 'text', 'muted'],
  ['themes', 'light', 'border', 'interactive'],
  ['surface', 'panel', 'light'],
  ['surface', 'panel', 'dark'],
];

/** Deterministic JSON serialization — sorts object keys at every level, so two semantically equal
 * trees serialize identically regardless of source formatting or key insertion order. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function scopedDigest(tokens) {
  const clone = JSON.parse(JSON.stringify(tokens));
  for (const path of FORKED_PATHS) {
    let node = clone;
    for (const key of path.slice(0, -1)) node = node?.[key];
    if (node && Object.hasOwn(node, path.at(-1))) delete node[path.at(-1)];
  }
  return createHash('sha256').update(stableStringify(clone)).digest('hex');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/token-scope-digest.mjs <path-to-tokens.json>  (or "-" for stdin)');
    process.exit(2);
  }
  const raw = path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
  console.log(scopedDigest(JSON.parse(raw)));
}
