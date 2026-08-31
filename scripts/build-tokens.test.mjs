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
 * Full byte-identity is the goal deliberately, not equality over some site-safe subset. The build
 * walks only `themes.*` plus named site-safe groups, so app-only families (signal, health,
 * elevation, motion, path-card) sitting in the JSON are inert — the containment lint at the bottom
 * of `build-tokens.mjs` is what keeps them out of the emitted CSS, and it checks the OUTPUT, not
 * this file. A single digest is also a rule that cannot itself drift, where a subtree comparison
 * would need its own group list kept current every time a token group is minted — a second
 * one-ended declaration in the machinery meant to close the first.
 *
 * The reciprocal half lives in `stock-analyst-platform`'s `.githooks/pre-commit`, which refuses a
 * commit touching the canonical file while this digest still names the old bytes. Neither repo's CI
 * can reach the other, so a recorded digest asserted at both ends is what makes the pair closed:
 * whichever side is edited goes red at the point of change and names the other.
 *
 * TO CHANGE A TOKEN: edit the canonical file in stock-analyst-platform, take the new digest from
 * that repo's pre-commit failure, copy the file here verbatim, and update CANONICAL_SHA256 in BOTH
 * places. There is no path that updates one without the other.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Keep in lockstep with CANONICAL_SHA256 in stock-analyst-platform's .githooks/pre-commit.
const CANONICAL_SHA256 = '424050971601d4576e738e20d6e12df41922c9fa95d4fc94c4be93d5af5f05eb';

describe("the site's token file is byte-identical to canonical", () => {
  it('hashes to the digest recorded upstream', () => {
    const bytes = readFileSync(join(root, 'tokens/twiceover.tokens.json'));
    expect(
      createHash('sha256').update(bytes).digest('hex'),
      'tokens/twiceover.tokens.json no longer matches stock-analyst-platform ' +
        'ai-team/design/tokens/twiceover.tokens.json — re-copy it verbatim and update ' +
        'CANONICAL_SHA256 here AND in that repo\'s .githooks/pre-commit',
    ).toBe(CANONICAL_SHA256);
  });

  it('still declares the version the digest was recorded against', () => {
    // A digest alone says "changed", never "changed to what". This gives the failure a human
    // coordinate, and fails independently if someone edits the version string to paper over a diff.
    const tokens = JSON.parse(readFileSync(join(root, 'tokens/twiceover.tokens.json'), 'utf8'));
    expect(/v(\d+\.\d+\.\d+)/.exec(tokens.$description)?.[1]).toBe('2.9.0');
  });
});
