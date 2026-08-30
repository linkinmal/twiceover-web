/**
 * The hand-run index generator's pure half, plus the committed artifact it produced
 * (ADR 0810 build order item 6, stock-analyst-platform#2965).
 *
 * The generator is deliberately never run in CI — it reaches sec.gov, and a SEC outage must never
 * fail an unrelated build. So what CI checks is exactly two things: the PROJECTION, exercised
 * against hand-built rows with no network, and the committed ARTIFACT, which is what actually
 * ships. Node environment: no DOM anywhere near this.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildIndex, serializeIndex, SUBMITTABLE_SYMBOL } from './gen-symbol-index.mjs';

const ARTIFACT = fileURLToPath(new URL('../src/data/symbol-index.json', import.meta.url));
const WORKER = fileURLToPath(new URL('../worker/index.js', import.meta.url));

const AT = '2026-08-30T00:00:00.000Z';

describe('the projection from SEC rows to shipped pairs', () => {
  it('upper-cases, trims, drops the unsubmittable, keeps the first of a duplicate, and sorts', () => {
    const index = buildIndex({
      generatedAt: AT,
      rows: [
        { cik_str: 3, ticker: 'nvda', title: '  NVIDIA CORP  ' }, // lower-case + padded
        { cik_str: 1, ticker: 'MSFT', title: 'MICROSOFT CORP' },
        { cik_str: 4, ticker: 'MSFT', title: 'Microsoft Corporation' }, // duplicate: first wins
        { cik_str: 5, ticker: 'BRK.B', title: 'Berkshire Hathaway' }, // punctuation: unsubmittable
        { cik_str: 6, ticker: 'TOOLONG', title: 'Seven Letters Inc' }, // >6: unsubmittable
        { cik_str: 7, ticker: '', title: 'No Symbol Corp' }, // skipped, not counted as dropped
        { cik_str: 8, ticker: 'NONAME', title: '   ' }, // skipped, not counted as dropped
      ],
    });

    expect.soft(index.symbols).toEqual([
      ['MSFT', 'MICROSOFT CORP'],
      ['NVDA', 'NVIDIA CORP'],
    ]);
    expect.soft(index.symbolCount).toBe(2);
    // Only the two REFUSED rows count as dropped; the two empty ones are absent, not refused.
    expect.soft(index.droppedCount).toBe(2);
    expect.soft(index.generatedAt).toBe(AT);
  });

  it('serializes the envelope pretty and the rows one per line, so the diff stays reviewable', () => {
    const json = serializeIndex(buildIndex({ generatedAt: AT, rows: [{ ticker: 'MU', title: 'Micron' }] }));
    expect.soft(json).toBe(
      '{\n  "generatedAt": "2026-08-30T00:00:00.000Z",\n  "symbolCount": 1,\n  "symbols": [\n["MU","Micron"]\n  ]\n}\n',
    );
    expect.soft(JSON.parse(json).symbols).toEqual([['MU', 'Micron']]);
  });
});

describe('the mirrored submit pattern cannot drift from the Worker’s', () => {
  it('is the same source string the Worker bounds the forwarded ticker with', () => {
    // The generator re-declares TICKER_PATTERN rather than importing it across the boundary. This
    // is the second end of that declaration: if the Worker's pattern moves, this goes red rather
    // than the index quietly diverging from what /go/try will accept.
    const worker = readFileSync(WORKER, 'utf8');
    expect.soft(worker).toContain(`const TICKER_PATTERN = ${SUBMITTABLE_SYMBOL.toString()}`);
  });
});

describe('the committed artifact — what actually ships', () => {
  const raw = readFileSync(ARTIFACT, 'utf8');
  const index = JSON.parse(raw);

  it('parses, clears a row floor, and carries known symbols with their names', () => {
    expect.soft(index.symbolCount).toBeGreaterThan(8000); // ~9,848 at porting; a floor, not a pin
    expect.soft(index.symbols).toHaveLength(index.symbolCount);
    expect.soft(typeof index.generatedAt).toBe('string');
    expect.soft(Number.isNaN(Date.parse(index.generatedAt))).toBe(false);

    const bySymbol = new Map(index.symbols);
    expect.soft(bySymbol.get('NVDA')).toMatch(/NVIDIA/i);
    expect.soft(bySymbol.get('MSFT')).toMatch(/MICROSOFT/i);
  });

  it('holds only submittable symbols, sorted, with no duplicate and no extra field', () => {
    const symbols = index.symbols.map(([s]) => s);
    expect.soft(symbols.every((s) => SUBMITTABLE_SYMBOL.test(s))).toBe(true);
    expect.soft(index.symbols.every((row) => row.length === 2)).toBe(true);
    expect.soft([...symbols].sort()).toEqual(symbols);
    expect.soft(new Set(symbols).size).toBe(symbols.length);
  });

  it('is one pair per line, so a regeneration diffs as rows rather than one 340 KB line', () => {
    const rowLines = raw.split('\n').filter((l) => l.startsWith('['));
    expect.soft(rowLines).toHaveLength(index.symbolCount);
  });
});
