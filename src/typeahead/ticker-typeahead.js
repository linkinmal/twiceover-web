/**
 * The vanilla ticker/company-name combobox — R1–R8 of read-components.md §6 (ADR 0810 build order
 * item 6, stock-analyst-platform#2965). twiceover-web's counterpart to twiceover-app's
 * `SymbolCombobox.tsx`, which owns the same invariants in React.
 *
 * The matching rules R1–R5 are NOT restated here: they live in `symbol-suggestions.ts`, ported
 * byte-identically from the app so the two surfaces cannot answer the same typed string
 * differently. What this file owns is what only a control can — the ARIA combobox/listbox wiring,
 * the keyboard, and the focus choreography. The two invariants that make this a control and not a
 * decoration:
 *   R6 — selecting fills the field and NEVER submits (ADR 0442 Amendment 1 R5's one-press assent);
 *   R7 — nothing is highlighted when the list opens, so Enter with no active option falls through
 *        to the form on the typed value.
 *
 * **Progressive enhancement, and this page's specific version of it.** With this script absent or
 * failed, `#entry-form` is exactly the plain HTML GET it was before: the browser serializes
 * `ticker` and navigates to /go/try. Nothing here is required for the handoff to work — the
 * listbox only ever adds a suggestion. That is why every branch below returns rather than throws.
 *
 * **R8 / containment.** This control consults the bundled deterministic index and nothing else. It
 * opens no connection of any kind, and the barred call names must not appear in this file even
 * inside a comment — `ci/check-entry-box.mjs` scans the built bundle TEXTUALLY, and the Worker's
 * `connect-src 'none'` backstops it at the browser (consult 0811).
 */
import { loadSymbolIndex } from './symbol-index.js';
import { matchSymbols } from './symbol-suggestions';

/** Ids must be unique per control but need not be stable across loads — the ARIA attributes are
 *  written from these same values, never looked up by a literal. */
let instanceSeq = 0;

/**
 * Wire one input as a combobox. Returns the control, or `null` when there is nothing to wire.
 *
 * @param {{ input: HTMLInputElement | null, loadIndex?: () => Promise<ReadonlyArray<[string,string]>> }} options
 */
export function createSymbolCombobox({ input, loadIndex = loadSymbolIndex }) {
  if (!input) return null;

  // The listbox anchors to this, so the wrapper carries `position: relative` in site.css. If the
  // markup ever loses the wrapper, anchor to the input's parent rather than mispositioning against
  // the viewport — the control still works, it just sits where the parent puts it.
  const container = input.closest('.symbol-combobox') ?? input.parentElement;
  if (!container) return null;

  const seq = (instanceSeq += 1);
  const listboxId = `symbol-listbox-${seq}`;
  const optionIdPrefix = `symbol-option-${seq}`;

  let index = [];
  /** R7 — `-1` is "nothing active": the state the list OPENS in and returns to on every edit. */
  let activeOption = -1;
  /** Escape closes the list without clearing the value, so "is the list open" cannot be derived
   *  from the value alone. Any subsequent edit resets it, which is what keeps R2 true. */
  let dismissed = false;
  let requestedIndex = false;
  let listboxEl = null;
  let suggestions = [];

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');
  // `aria-controls` is deliberately NOT set here. R3 means the listbox element exists only while
  // open, so a constant `aria-controls` would point at no element in the default state of every
  // page load and after every close — a dangling IDREF is an ARIA validation failure that some
  // screen readers report. It is set and removed alongside `aria-expanded` instead.

  function closeList() {
    if (listboxEl) {
      listboxEl.remove();
      listboxEl = null;
    }
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    input.removeAttribute('aria-controls'); // never point at an element that is not in the DOM
  }

  /** R3 — an empty result renders NO listbox at all: not an empty state, not a "No results" row,
   *  not a count. The element is created when there is something to show and removed when there
   *  is not, rather than hidden. */
  function render() {
    const result = matchSymbols(input.value, index);
    suggestions = result.entries;

    if (dismissed || suggestions.length === 0) {
      closeList();
      return;
    }

    if (!listboxEl) {
      listboxEl = document.createElement('ul');
      listboxEl.className = 'symbol-combobox__listbox';
      listboxEl.id = listboxId;
      listboxEl.setAttribute('role', 'listbox');
      listboxEl.setAttribute('aria-label', 'Symbol suggestions');
      container.appendChild(listboxEl);
    }
    listboxEl.replaceChildren();

    suggestions.forEach(([symbol, name], i) => {
      const option = document.createElement('li');
      option.className = 'symbol-combobox__option';
      option.id = `${optionIdPrefix}-${i}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(i === activeOption));
      option.dataset.symbol = symbol;
      if (i === activeOption) option.dataset.active = 'true';
      // R5's two blocks, made visible: the rule sits where the name block begins. A data attribute
      // rather than a presentational <li> — a non-option child of a listbox is a node screen
      // readers must be told to ignore, and this needs telling nobody. `symbolMatchCount === 0`
      // means every row is a name match, so no rule.
      if (i === result.symbolMatchCount && result.symbolMatchCount > 0) {
        option.setAttribute('data-block-start', '');
      }

      const symbolEl = document.createElement('span');
      symbolEl.className = 'symbol-combobox__option-symbol';
      symbolEl.textContent = symbol;
      const nameEl = document.createElement('span');
      nameEl.className = 'symbol-combobox__option-name';
      nameEl.textContent = name;
      option.append(symbolEl, nameEl);

      // Two handlers, and the split is load-bearing (R6's trip-wire: "reopens if any build submits
      // on select, for any reason").
      //
      // `mousedown` ONLY holds focus. It must not select, because selecting here removes the
      // listbox synchronously — and `preventDefault` on mousedown does not suppress the `click`
      // that follows. On this site's STACKED mobile layout the first option sits almost exactly on
      // top of the "Get the read" submit button (option +16px..+60px below the field, button
      // +12px..+56px — a 44px overlap), so deleting the option mid-gesture leaves the tap's own
      // click to hit-test onto the submit button underneath and GET /go/try: a read the visitor
      // never assented to, from a tap they aimed at a suggestion. That is the classic touch
      // click-through, and it is invisible on a desktop mouse.
      //
      // Selecting on `click` keeps the option under the pointer until the click has been
      // dispatched, so there is nothing to fall through to. The blur race the mousedown guard
      // exists for is still closed: preventing mousedown's default stops the focus change, so the
      // field never blurs and the list is still standing when click arrives.
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      option.addEventListener('click', () => {
        choose(symbol);
      });

      listboxEl.appendChild(option);
    });

    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', listboxId);
    if (activeOption >= 0) input.setAttribute('aria-activedescendant', `${optionIdPrefix}-${activeOption}`);
    else input.removeAttribute('aria-activedescendant');
  }

  const isOpen = () => listboxEl !== null;

  /** R7 — a changed value can never leave a stale option active. */
  function edit() {
    activeOption = -1;
    dismissed = false; // R2 — an edit reopens the list; Escape's close is not a mode
    render();
  }

  /** R6 — a chosen option replaces the value with the bare symbol and returns focus to the field.
   *  It does NOT submit, for any reason: the press stays the one and only assent act. */
  function choose(symbol) {
    input.value = symbol;
    activeOption = -1;
    dismissed = true;
    closeList();
    input.focus();
  }

  function moveActive(delta) {
    if (delta > 0) activeOption = (activeOption + 1) % suggestions.length;
    else activeOption = activeOption <= 0 ? suggestions.length - 1 : activeOption - 1;
    render();
  }

  // #2908's Architect close: the index loads on FIRST FOCUS, not at page load. A plain flag, not
  // state — a second focus must not re-request.
  input.addEventListener('focus', () => {
    if (requestedIndex) return;
    requestedIndex = true;
    void loadIndex().then((rows) => {
      index = rows;

      // An empty result is how `symbol-index.js` reports a failed load (R3: a failure is silence,
      // not an error). Clearing the flag is what makes its documented "the next focus retries"
      // true — the loader clears its own memo, but with this flag latched no second call was ever
      // made, so the retry it describes could not happen.
      if (rows.length === 0) requestedIndex = false;

      // Only render if the field is STILL the focused element. The chunk is ~342 KB, so a visitor
      // who focuses, types, and then tabs or taps toward the submit button can easily be gone
      // before it lands — and rendering then pops a z-index:20 listbox over the submit button with
      // focus nowhere in the control and `aria-expanded="true"` on an unfocused input. Their next
      // tap lands on the listbox instead of the button they were aiming at.
      if (document.activeElement === input) render();
    });
  });

  input.addEventListener('input', edit);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Closes without clearing (R7). Not prevented unconditionally — with the list already closed,
      // Escape belongs to the browser's own field reset, which is the platform behaviour expected.
      if (isOpen()) {
        event.preventDefault();
        dismissed = true;
        activeOption = -1;
        closeList();
      }
      return;
    }

    if (!isOpen()) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter' && activeOption >= 0) {
      // R7 — Enter reaches an option ONLY when the user has arrowed onto one. With nothing active
      // this branch is skipped entirely and the form's own submit fires on the typed value, so a
      // typed word and a press always reach the input's own value, never a stray option.
      event.preventDefault();
      choose(suggestions[activeOption][0]);
    }
  });

  // The field losing focus closes the list. This is scoped to the INPUT deliberately, and it is
  // sound here only because of two facts that hold on this surface: the options are `<li>`s, which
  // are not focusable, and their `mousedown` default is prevented, so a pointer press on an option
  // never moves focus and so never fires this. (ADR 0810 Amendment 2's wider "the host's whole
  // control" boundary answers a different problem — the app masthead's field COLLAPSES on focus
  // leave, so it must not collapse when a user tabs to the adjacent submit button. Nothing
  // collapses here; the field stays exactly where it is, so closing the list on the input's own
  // blur costs a tabbing user nothing.)
  input.addEventListener('blur', () => {
    if (isOpen()) closeList();
  });

  return { render, close: closeList };
}

/** The page's one mount point. Kept separate from the factory so the control is constructible in a
 *  test without a page around it. */
export function mountEntryBoxTypeahead(doc = document) {
  return createSymbolCombobox({ input: doc.getElementById('entry-ticker') });
}
