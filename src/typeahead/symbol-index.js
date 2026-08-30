/**
 * The lazy load of the bundled symbol index (read-components.md §6, ADR 0810 build order item 6,
 * stock-analyst-platform#2965). twiceover-web's counterpart to twiceover-app's `symbol-index.ts`.
 *
 * **Not a byte-identical port, and deliberately so.** Unlike `symbol-suggestions.ts` next door —
 * which is pure and therefore portable verbatim — the app's loader is bound to its own asset path,
 * its own bundler, and a `__resetSymbolIndexForTest` seam React's isolation needs. Copying it here
 * would have meant a second file claiming byte-identity it could never hold. What IS carried over
 * is the behaviour that matters, restated below.
 *
 * **Lazy, and lazy on purpose.** `../data/symbol-index.json` is ~344 KB raw (~87 KB brotli over the
 * wire). #2908 ruled it loads on FIRST FOCUS of the entry field, not at page load — so this is a
 * dynamic `import()`, which Vite emits as its own content-hashed chunk under /_astro/. That matters
 * more here than in the app: this is a marketing landing page, and a visitor who never touches the
 * box never pays for the index. The content hash is also the cache-bust.
 *
 * **A failed load is silence, not an error.** R3 — "no matches, no listbox. Never an empty state,
 * never 'No results,' never a count." A visitor typing a word who meets a chunk hiccup must see
 * exactly what a visitor typing an unmatched word always sees: nothing. So every failure path here
 * resolves to an empty index. This is not a swallowed error in the Optimistic-Path sense: the
 * degraded state is the SPECIFIED state, identical to the far more common no-match case, and the
 * entry box's own function is untouched — with this file absent entirely, the form still submits.
 */

const EMPTY = [];

/** The one-shot memo. Holds the in-flight promise (not just the settled value) so two focus events
 *  in the same tick share one chunk load rather than racing two. */
let pending;

function isEntry(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'string'
  );
}

/**
 * Validated, not trusted. The file is ours and committed, but it is also machine-written by a
 * generator that is deliberately not run in CI (`scripts/gen-symbol-index.mjs`), so a shape check
 * here is what keeps a malformed artifact from reaching the render as `undefined` rows.
 */
function readEntries(module) {
  const symbols = module?.default?.symbols;
  if (!Array.isArray(symbols)) return EMPTY;
  return symbols.filter(isEntry);
}

export async function loadSymbolIndex(importChunk = () => import('../data/symbol-index.json')) {
  // A rejected load is deliberately NOT memoized: `pending` is cleared on failure so the next focus
  // retries. Caching the failure would leave the box without suggestions for the whole session over
  // one transient chunk load.
  pending ??= importChunk()
    .then(readEntries)
    .catch(() => {
      pending = undefined;
      return EMPTY;
    });
  return pending;
}

/** Test-only: clears the module-scoped memo between cases. */
export function __resetSymbolIndexForTest() {
  pending = undefined;
}
