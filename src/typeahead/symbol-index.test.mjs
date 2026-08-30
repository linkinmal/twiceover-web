/**
 * The lazy index loader (ADR 0810 build order item 6, stock-analyst-platform#2965).
 *
 * These cases exist because the loader had NONE: `ticker-typeahead.test.mjs` injects `loadIndex`,
 * so the memo, the shape validation, and the failure→empty path all shipped unexercised — including
 * the "validated, not trusted" check the file's own docblock says is what keeps a malformed
 * artifact from reaching the render as `undefined` rows. A declaration with nothing reading it.
 *
 * Node environment: this is module behaviour over an injected importer, no DOM involved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSymbolIndex, __resetSymbolIndexForTest } from './symbol-index.js';

const mod = (symbols) => ({ default: { generatedAt: 'x', symbolCount: 0, symbols } });

beforeEach(() => {
  __resetSymbolIndexForTest();
});

describe('the chunk is loaded once and shared', () => {
  it('memoizes the in-flight promise, so two focuses in one tick share one load', async () => {
    const importChunk = vi.fn(() => Promise.resolve(mod([['MU', 'Micron']])));
    const [a, b] = await Promise.all([loadSymbolIndex(importChunk), loadSymbolIndex(importChunk)]);
    expect.soft(importChunk, 'the in-flight promise is held, not just the settled value').toHaveBeenCalledTimes(1);
    expect.soft(a).toEqual([['MU', 'Micron']]);
    expect.soft(b).toBe(a);
  });
});

describe('validated, not trusted — a malformed artifact never reaches the render', () => {
  it('drops rows that are not [string, string], and keeps the good ones', async () => {
    const rows = await loadSymbolIndex(() =>
      Promise.resolve(
        mod([
          ['MU', 'Micron'], // good
          ['MSFT'], // too short
          ['NVDA', 'NVIDIA', 'extra'], // too long
          [1, 'Numeric symbol'], // wrong type
          ['SMCI', null], // wrong type
          null, // not an array
          'MSFT', // not an array
        ]),
      ),
    );
    expect(rows).toEqual([['MU', 'Micron']]);
  });

  it.each([
    ['symbols missing', { default: {} }],
    ['symbols not an array', { default: { symbols: { MU: 'Micron' } } }],
    ['no default export', {}],
    ['module is null', null],
  ])('resolves to an empty index when %s — never throws, never undefined rows', async (_label, module) => {
    await expect(loadSymbolIndex(() => Promise.resolve(module))).resolves.toEqual([]);
  });
});

describe('a failed load is silence, and it is retried', () => {
  it('resolves empty rather than rejecting — R3, the specified state, not an error', async () => {
    await expect(loadSymbolIndex(() => Promise.reject(new Error('chunk 404')))).resolves.toEqual([]);
  });

  it('does NOT memoize the failure — the next call retries and can succeed', async () => {
    // The file's docblock promises exactly this ("`pending` is cleared on failure so the next
    // focus retries"). Without the caller also clearing its own once-only flag the retry is
    // unreachable in production, which is why `ticker-typeahead.js` clears it on an empty result.
    const importChunk = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(mod([['MU', 'Micron']]));

    expect.soft(await loadSymbolIndex(importChunk)).toEqual([]);
    expect.soft(await loadSymbolIndex(importChunk)).toEqual([['MU', 'Micron']]);
    expect.soft(importChunk).toHaveBeenCalledTimes(2);
  });
});

describe('the empty singleton cannot be mutated by one caller into another caller’s view', () => {
  it('hands back a frozen array on the failure path', async () => {
    const rows = await loadSymbolIndex(() => Promise.resolve({ default: {} }));
    expect.soft(Object.isFrozen(rows)).toBe(true);
    expect.soft(() => rows.push(['X', 'Y'])).toThrow();
  });
});
