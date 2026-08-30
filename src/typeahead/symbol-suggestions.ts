/**
 * The typeahead's matching rules — R1–R5 of read-components.md §6 (v3.40), ported from the signed
 * concept's inline reference implementation (`ai-team/design/assets/typeahead-prose-rule-2026-08-29.html`,
 * stock-analyst-platform#2919).
 *
 * **Not to be confused with `packages/parse/src/typeahead.ts`**, which shares the word and nothing
 * else. That one is ADR 0013 funnel step 5 — a SERVER-side degradation returned when the LLM parse
 * is refused or fails, symbol-prefix only, emitting branded `Ticker`s over an injected search that
 * has no production implementation (and `@twiceover/parse` reaches no app today). This one is the
 * FIELD's live listbox: client-side, company names included, R1's one-word gate and R5's two-block
 * order, and it never speaks to the server at all.
 *
 * A pure function of the current value and the index: no mode, no memory, no network, no clock (R2).
 * R8's containment restated at this grain — this consults the bundled deterministic index and
 * nothing else; free text reaches the parse model at submit and nowhere else.
 */

/** A shipped index row: the bare symbol and the filer's own name, in that order. */
export type SymbolIndexEntry = readonly [symbol: string, name: string];

/**
 * R5's two blocks, kept distinct in the RESULT rather than re-derived by the view.
 *
 * The signed concept renders a rule between the symbol block and the name block, so the render needs
 * to know where one ends. Returning the count is the alternative to the view re-testing
 * `entry[0].startsWith(query)` — a second copy of the block predicate, in a second place, free to
 * drift from this one.
 */
export interface SuggestionResult {
  /** Both blocks concatenated, in render order, already capped. */
  readonly entries: readonly SymbolIndexEntry[];
  /** How many leading `entries` came from the symbol block — the divider's index. Never exceeds
   *  `entries.length` (the cap can cut into the symbol block). */
  readonly symbolMatchCount: number;
}

/** R5 — "eight shown". */
export const MAX_SUGGESTIONS = 8;

/**
 * R1's gate: a single word of letters, nothing else.
 *
 * This is the whole prose defence, and it is deliberately not a model and not intent-guessing —
 * prose has spaces and a lookup doesn't. Digits and punctuation are excluded because a ticker is
 * letters (S4's `^[A-Z]{1,6}$`) and everything else is the shape of a question.
 */
const SINGLE_WORD = /^[A-Za-z]+$/;

/** R5 — the name block needs two characters where the symbol block opens at one. */
const MIN_NAME_QUERY = 2;

/** R5 — a name matches on a WORD prefix, never an inner substring: "micro" finds Micron and Super
 *  Micro, "ro" finds neither. Split on anything that isn't a letter or digit so "Inc.", hyphens and
 *  ampersands all start fresh words. */
const EMPTY_RESULT: SuggestionResult = { entries: [], symbolMatchCount: 0 };

function matchesNameWordPrefix(name: string, lowerQuery: string): boolean {
  for (const word of name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word !== '' && word.startsWith(lowerQuery)) return true;
  }
  return false;
}

/**
 * The suggestions for a raw field value, in render order.
 *
 * Order is R5's, and it is load-bearing: symbol-prefix matches first, then company-name matches,
 * lexical within each block. The index is already sorted lexically by symbol at generation, so a
 * single forward pass preserves that order in both blocks with no runtime sort — and nothing here
 * can reorder by holdings, P&L, or analysis, because none of that is reachable from this signature.
 *
 * Returns no entries — never a marker row, a count, or an empty-state sentinel — when the gate fails
 * or nothing matches (R3). The caller renders no listbox at all for an empty result.
 */
export function matchSymbols(
  rawValue: string,
  index: readonly SymbolIndexEntry[],
): SuggestionResult {
  const query = rawValue.trim();
  if (!SINGLE_WORD.test(query)) return EMPTY_RESULT; // R1 (also covers the empty string)

  const upper = query.toUpperCase();
  const lower = query.toLowerCase();
  const nameEligible = query.length >= MIN_NAME_QUERY;

  const bySymbol: SymbolIndexEntry[] = [];
  const byName: SymbolIndexEntry[] = [];

  for (const entry of index) {
    // `else if`, not a second `if` — a row matching both ways belongs to the symbol block once,
    // never to both. Same structure as the signed concept's own loop.
    if (entry[0].startsWith(upper)) bySymbol.push(entry);
    else if (nameEligible && matchesNameWordPrefix(entry[1], lower)) byName.push(entry);

    // The symbol block alone can already fill the cap, but the name block cannot be skipped early:
    // a later symbol match still outranks every name match, so the pass runs to the end and the
    // slice happens once, below.
  }

  const entries = [...bySymbol, ...byName].slice(0, MAX_SUGGESTIONS);
  return { entries, symbolMatchCount: Math.min(bySymbol.length, entries.length) };
}
