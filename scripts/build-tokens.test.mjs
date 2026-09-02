/**
 * The DOWNSTREAM end of the token file's byte-identity declaration
 * (stock-analyst-platform#2991).
 *
 * `tokens/twiceover.tokens.json` is a copy of the canonical DTCG file that lives in
 * `stock-analyst-platform` at `ai-team/design/tokens/twiceover.tokens.json`. `build-tokens.mjs`'s
 * header has always said so; until this test, nothing checked it, and the two had silently drifted
 * apart across nine minor versions — the site was still emitting the pre-Studio palette while
 * canonical had retoned the canvas and moved the accent surface to bronze. #2965 found one slice of
 * that (`bg.inset` and the whole `layer` group missing) only by accident, weeks after the fact.
 *
 * NOT whole-file identity. Four groups are DELIBERATELY forked from canonical (Designer role-gate
 * verdict on this PR, #67): `bg.canvas` (both themes), `text.muted` (light), `border.interactive`
 * (light), `surface.panel` (both themes) — all ADR 0340's Studio retone. ADR 0340 itself left
 * whether Studio extends to this site to consult 0341 (Designer -> Growth), which is still Open —
 * adopting those four groups here would have answered a standing, explicitly-deferred cross-role
 * question as a side effect of a token-drift sync, not as an actual ruling from the role that owns
 * it. `scripts/token-scope-digest.mjs` hashes the file with exactly those leaves deleted first, so
 * this test tracks everything ELSE 1:1 (the bronze `accent-surface` retone #2987 already has founder
 * approval for, the typography additions, and anything else) while staying silent on the fork.
 *
 * A single scoped digest is a rule that cannot itself drift, where a subtree comparison written by
 * hand would need its own group list kept current every time a token group is minted — a second
 * one-ended declaration in the machinery meant to close the first. `token-scope-digest.mjs`'s
 * `FORKED_PATHS` IS that list, in exactly one place per repo (see the lockstep note below).
 *
 * The reciprocal half lives in `stock-analyst-platform`'s `.githooks/pre-commit`, which runs the
 * identical scoped-digest algorithm and refuses a commit touching the canonical file's tracked
 * groups while this digest still names the old bytes. Neither repo's CI can reach the other, so a
 * recorded digest asserted at both ends is what makes the pair closed: whichever side is edited
 * (outside the fork) goes red at the point of change and names the other.
 *
 * TO CHANGE A TRACKED TOKEN: edit the canonical file in stock-analyst-platform, take the new digest
 * from that repo's pre-commit failure, copy the file here verbatim (then re-apply this site's own
 * forked values over the four groups above), and update CANONICAL_SCOPED_SHA256 in BOTH places.
 * TO CHANGE ONE OF THE FOUR FORKED GROUPS: that's this repo's own call (consult 0341) — edit it
 * here directly; the scoped digest doesn't see it either way.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scopedDigest, FORKED_PATHS } from './token-scope-digest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Keep in lockstep with CANONICAL_SCOPED_SHA256 in stock-analyst-platform's .githooks/pre-commit —
// and keep FORKED_PATHS in token-scope-digest.mjs in lockstep with that repo's copy of the same
// file. There is no cross-repo import for either; if the two ever drift, both sides' digests stop
// agreeing and BOTH go red (fails closed, never silently trusts a mismatch).
const CANONICAL_SCOPED_SHA256 = '057810ef1fbbcf0d8a0b95bca03500e04cd7fd50f57c9535c5240f8b0739543b';

describe("the site's token file matches canonical outside its deliberate fork", () => {
  it('hashes to the digest recorded upstream, with the forked groups excluded', () => {
    const tokens = JSON.parse(readFileSync(join(root, 'tokens/twiceover.tokens.json'), 'utf8'));
    expect(
      scopedDigest(tokens),
      'tokens/twiceover.tokens.json no longer matches stock-analyst-platform ' +
        "ai-team/design/tokens/twiceover.tokens.json outside the forked groups — re-copy it, " +
        're-apply the fork, and update CANONICAL_SCOPED_SHA256 here AND in that repo\'s ' +
        '.githooks/pre-commit',
    ).toBe(CANONICAL_SCOPED_SHA256);
  });

  it('still declares the version the digest was recorded against', () => {
    // A digest alone says "changed", never "changed to what". This gives the failure a human
    // coordinate, and fails independently if someone edits the version string to paper over a diff.
    const tokens = JSON.parse(readFileSync(join(root, 'tokens/twiceover.tokens.json'), 'utf8'));
    expect(/v(\d+\.\d+\.\d+)/.exec(tokens.$description)?.[1]).toBe('2.10.0');
  });

  it('still forks exactly the four groups the Designer ruled on — no silent widening or narrowing', () => {
    // The digest is BLIND to these paths by construction; this is the only place that names them
    // as forked rather than merely absent from the scoped hash, so a change to WHICH groups are
    // forked (as opposed to what their forked values are) shows up here rather than nowhere.
    expect(FORKED_PATHS).toEqual([
      ['themes', 'light', 'bg', 'canvas'],
      ['themes', 'dark', 'bg', 'canvas'],
      ['themes', 'light', 'text', 'muted'],
      ['themes', 'light', 'border', 'interactive'],
      ['surface', 'panel', 'light'],
      ['surface', 'panel', 'dark'],
    ]);
  });

  it('forked leaves carry the frozen pre-Studio value and name consult 0341', () => {
    const tokens = JSON.parse(readFileSync(join(root, 'tokens/twiceover.tokens.json'), 'utf8'));
    const frozen = [
      [tokens.themes.light.bg.canvas, '#F7F3EA'],
      [tokens.themes.dark.bg.canvas, '#1A1713'],
      [tokens.themes.light.text.muted, '#6B6358'],
      [tokens.themes.light.border.interactive, '#867D69'],
      [tokens.surface.panel.light, '#EEE7D6'],
      [tokens.surface.panel.dark, '#14110D'],
    ];
    for (const [node, expected] of frozen) {
      expect.soft(node.$value, JSON.stringify(node)).toBe(expected);
      expect.soft(node.$description, JSON.stringify(node)).toMatch(/consult 0341/);
    }
  });
});
