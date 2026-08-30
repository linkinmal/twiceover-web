/**
 * The ported matcher — R1–R5 of read-components.md §6, plus the byte-identity check that keeps
 * this copy from drifting from twiceover-app's (ADR 0810 build order item 6,
 * stock-analyst-platform#2965).
 *
 * **Why the behaviour cases are re-stated here rather than "it's a verbatim port, trust it."**
 * Byte-identity proves the SOURCE matches; it proves nothing about what this repo's toolchain
 * compiles it into. twiceover-app builds this file under Vite/React with its own tsconfig target;
 * twiceover-web builds it under Astro's. R1's regex and R5's two-block order are what the site's
 * listbox actually depends on, so they are asserted against the file as THIS repo loads it.
 *
 * Node environment (no docblock) — a pure function, per conventions.md §Testing "pure logic in
 * node, not jsdom". The DOM-facing combobox carries its own jsdom docblock in its own file.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchSymbols, MAX_SUGGESTIONS } from './symbol-suggestions';

const PORT = fileURLToPath(new URL('./symbol-suggestions.ts', import.meta.url));
const CANONICAL = fileURLToPath(new URL('./symbol-suggestions.canonical.txt', import.meta.url));

/**
 * SHA-256 of `apps/web/src/read/symbol-suggestions.ts` at twiceover-app `origin/main` f0f8… as
 * ported on 2026-08-30. Recorded as a VALUE, not just as a file comparison, so the upstream leg is
 * nameable: an identical assertion in twiceover-app's own `symbol-suggestions.test.ts` turns THAT
 * repo red when the canonical file moves, naming this one (the second end of the declaration —
 * follow-up issue, since neither repo's CI can reach the other).
 */
const UPSTREAM_SHA256 = 'adf788c229fc144cebd9beda6427e1b07fab1ea5ccb99a68e5fed5c4227ebe63';

/** Three rows, hand-built: enough to exercise both blocks and the block boundary, and small enough
 *  that a failure names a row rather than an offset into 9,848.
 *
 *  **Sorted lexically by symbol, because the shipped artifact is.** R5's "lexical within each block"
 *  is not a runtime sort — `matchSymbols` makes ONE forward pass and preserves input order, so the
 *  generator's sort IS the ordering guarantee (`build-index.ts`: "the shipped bytes ARE the
 *  ordering guarantee"). A fixture in any other order tests a file the site never ships. */
const INDEX = [
  ['MSFT', 'MICROSOFT CORP'],
  ['MU', 'Micron Technology, Inc.'],
  ['SMCI', 'Super Micro Computer, Inc.'],
];

describe('the ported matcher is byte-identical to twiceover-app’s', () => {
  it('matches the canonical copy exactly, and hashes to the recorded upstream value', () => {
    const port = readFileSync(PORT, 'utf8');
    const canonical = readFileSync(CANONICAL, 'utf8');
    expect.soft(port).toBe(canonical);
    expect.soft(createHash('sha256').update(port).digest('hex')).toBe(UPSTREAM_SHA256);
    expect.soft(createHash('sha256').update(canonical).digest('hex')).toBe(UPSTREAM_SHA256);
  });
});

describe('R1 — one word of letters opens it, anything else closes it', () => {
  it('gates on the trimmed value, and a second word is what shuts it', () => {
    expect.soft(matchSymbols('  mu  ', INDEX).entries.length).toBeGreaterThan(0); // trimmed first
    expect.soft(matchSymbols('', INDEX).entries).toEqual([]);
    expect.soft(matchSymbols('what is mu', INDEX).entries).toEqual([]); // inner space
    expect.soft(matchSymbols('mu ', INDEX).entries.length).toBeGreaterThan(0); // trailing space is not a second word
    expect.soft(matchSymbols('mu7', INDEX).entries).toEqual([]); // digits
    expect.soft(matchSymbols("mu's", INDEX).entries).toEqual([]); // punctuation
  });
});

describe('R2 — a pure function of the current value, with no mode and no memory', () => {
  it('reopens on the way back down from a sentence to one word', () => {
    const opened = matchSymbols('mu', INDEX);
    matchSymbols('mu is a memory name', INDEX); // a closing call in between changes nothing
    expect.soft(matchSymbols('mu', INDEX)).toEqual(opened);
  });
});

describe('R3 — no matches, no listbox', () => {
  it('returns no entries and no sentinel row for a word nothing matches', () => {
    const result = matchSymbols('zzzz', INDEX);
    expect.soft(result.entries).toEqual([]);
    expect.soft(result.symbolMatchCount).toBe(0);
  });
});

describe('R4 — the suggestion gate is not the submit validator', () => {
  it('suggests on a company name longer than TICKER_PATTERN’s six letters', () => {
    expect.soft(matchSymbols('microsoft', INDEX).entries).toEqual([['MSFT', 'MICROSOFT CORP']]);
  });
});

describe('R5 — symbol block first, then name block, lexical within each, eight shown', () => {
  it('orders the two blocks and reports the divider index', () => {
    // "m" — one letter: symbol block only (the name block needs two).
    const oneLetter = matchSymbols('m', INDEX);
    expect.soft(oneLetter.entries.map(([s]) => s)).toEqual(['MSFT', 'MU']); // lexical, not index order
    expect.soft(oneLetter.symbolMatchCount).toBe(2); // every row a symbol match — no divider drawn

    // "mu" — MU by symbol, then the name block.
    const twoLetter = matchSymbols('mu', INDEX);
    expect.soft(twoLetter.entries.map(([s]) => s)).toEqual(['MU']);
    expect.soft(twoLetter.symbolMatchCount).toBe(1);
  });

  it('matches a name on a WORD prefix, never an inner substring', () => {
    // "micro" finds Micron and Super Micro; "ro" finds neither.
    const micro = matchSymbols('micro', INDEX);
    expect.soft(micro.entries.map(([s]) => s)).toEqual(['MSFT', 'MU', 'SMCI']);
    expect.soft(micro.symbolMatchCount).toBe(0); // every row a name match — no divider drawn
    expect.soft(matchSymbols('ro', INDEX).entries).toEqual([]);
  });

  it('never claims a row for both blocks, and caps at eight', () => {
    // 12 rows all matching by symbol, plus one matching only by name.
    const wide = [
      ...Array.from({ length: 12 }, (_, i) => [`A${String.fromCharCode(65 + i)}`, 'Unrelated Corp']),
      ['ZZZ', 'Alpha Holdings'],
    ];
    const result = matchSymbols('a', wide);
    expect.soft(result.entries).toHaveLength(MAX_SUGGESTIONS);
    expect.soft(MAX_SUGGESTIONS).toBe(8);
    // The cap cut into the symbol block, so symbolMatchCount never exceeds what was returned.
    expect.soft(result.symbolMatchCount).toBe(8);
    expect.soft(result.entries.every(([s]) => s.startsWith('A'))).toBe(true);
  });
});

describe('R8 — the typeahead reaches nothing but the index it is handed', () => {
  /** Every source file that ships INTO the entry-box bundle. Listed here rather than globbed so
   *  adding a fourth file is a deliberate act that names itself in this test. */
  const SHIPPED = ['symbol-suggestions.ts', 'symbol-index.js', 'ticker-typeahead.js'];

  it('carries no network primitive in any shipped source, inline or in a comment', () => {
    // `ci/check-entry-box.mjs` scans the BUILT bundle textually, so a barred call name must not
    // appear even inside prose. Asserted here at the source too, so an edit fails in the unit
    // suite — seconds — rather than only at the build gate, minutes later and further from the
    // change. Node environment, deliberately: this is a filesystem read, not a DOM one.
    for (const file of SHIPPED) {
      const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
      for (const barred of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/]) {
        expect.soft(barred.test(source), `${file}: ${barred.source} must not appear`).toBe(false);
      }
    }
  });
});
