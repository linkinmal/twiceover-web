/**
 * @vitest-environment jsdom
 *
 * The vanilla combobox — R1–R8 of read-components.md §6 at the DOM grain (ADR 0810 build order
 * item 6, stock-analyst-platform#2965). Behavioural parity with twiceover-app's `SymbolCombobox`,
 * which owns the same invariants in React.
 *
 * **The jsdom docblock above is deliberately per-FILE.** twiceover-web's suite runs in node; a
 * jsdom environment costs ~2s a node file does not (conventions.md §Testing), and the ported
 * matcher next door has no DOM to speak of. Switching the whole suite to pay for one file would be
 * the wrong trade — this docblock is why there is no `vitest.config`.
 *
 * **On R6/R7 and form submission:** jsdom does not implement the WHATWG "implicit submission" a
 * bare Enter triggers in a browser, so "Enter submits" cannot be observed here directly. What CAN
 * be observed is the seam this component actually owns: whether it calls `preventDefault()` on the
 * keydown. With an option active it must (R6 — selecting never submits); with nothing active it
 * must not (R7 — Enter falls through to the form on the typed value). Those two are asserted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSymbolCombobox } from './ticker-typeahead.js';

const INDEX = [
  // MICC is here so that ONE query ('mic') yields a symbol match AND name matches, making R5's
  // divider reachable. Without such a row every fixture query lands wholly in one block, the
  // divider is structurally unrenderable, and assertions about it pass no matter what the
  // component does. This is the real shape too — 'mic' against the shipped index returns MICC by
  // symbol and Micron/Microsoft/Super Micro by name. Sorted by symbol, as the artifact is.
  ['MICC', 'Magnum Ice Cream Co N.V.'],
  ['MSFT', 'MICROSOFT CORP'],
  ['MU', 'Micron Technology, Inc.'],
  ['NVDA', 'NVIDIA CORP'],
  ['SMCI', 'Super Micro Computer, Inc.'],
];

/** The hero markup as `index.astro` renders it, wrapper and all. */
function mount() {
  document.body.innerHTML = `
    <form id="entry-form" action="/go/try" method="get" novalidate>
      <label class="visually-hidden" for="entry-ticker">A ticker</label>
      <div class="symbol-combobox entry-box__field-wrap">
        <input id="entry-ticker" name="ticker" type="text" autocomplete="off" spellcheck="false" />
      </div>
      <button type="submit" class="entry-box__submit">Get the read</button>
    </form>`;
  const input = document.getElementById('entry-ticker');
  const loadIndex = vi.fn(() => Promise.resolve(INDEX));
  const control = createSymbolCombobox({ input, loadIndex });
  return { input, loadIndex, control, form: document.getElementById('entry-form') };
}

/** Focus, let the index promise settle, then type — the ordinary path into every case below. */
async function type(input, value) {
  input.focus();
  await Promise.resolve();
  await Promise.resolve();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function listbox() {
  return document.querySelector('[role="listbox"]');
}
function options() {
  return [...document.querySelectorAll('[role="option"]')];
}
/** Dispatch a key and hand back the event, so `defaultPrevented` is inspectable. */
function press(input, key) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the index loads once, on first focus', () => {
  it('does not load at construction, loads on the first focus, and never twice', async () => {
    const { input, loadIndex } = mount();
    expect.soft(loadIndex).not.toHaveBeenCalled();
    input.focus();
    // `input.blur()`, NOT `dispatchEvent(new Event('blur'))`: a synthetic blur event does not move
    // `document.activeElement`, so the following `focus()` would be a no-op on an already-focused
    // element and fire no focus event at all — the guard would then be "verified" by an event that
    // never happened. Deleting the guard used to leave this file green.
    input.blur();
    input.focus();
    await Promise.resolve();
    expect.soft(loadIndex).toHaveBeenCalledTimes(1);
  });
});

describe('a late index arrival never opens a listbox on a field nobody is focused in', () => {
  it('renders on arrival while still focused, and stays shut when focus has already left', async () => {
    // The chunk is ~342 KB. A visitor who focuses, types, then tabs toward the submit button can
    // easily be gone before it lands; rendering then would pop a z-index:20 listbox over that
    // button with focus nowhere in the control.
    let release;
    const loadIndex = () => new Promise((res) => { release = res; });
    document.body.innerHTML = `
      <form id="entry-form" action="/go/try" method="get" novalidate>
        <div class="symbol-combobox"><input id="entry-ticker" name="ticker" type="text" /></div>
        <button type="submit">Get the read</button>
      </form>`;
    const input = document.getElementById('entry-ticker');
    createSymbolCombobox({ input, loadIndex });

    input.focus();
    input.value = 'm';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur(); // gone before the chunk lands
    release(INDEX);
    await Promise.resolve();
    await Promise.resolve();

    expect.soft(listbox(), 'no listbox may appear on an unfocused field').toBeNull();
    expect.soft(input.getAttribute('aria-expanded')).toBe('false');
    expect.soft(input.hasAttribute('aria-controls'), 'no dangling IDREF while closed').toBe(false);
  });
});

describe('R1/R3 — one word opens it; no matches, no listbox', () => {
  it('renders no listbox at all for a sentence, a non-match, or an empty field', async () => {
    const { input } = mount();
    await type(input, 'what is mu');
    expect.soft(listbox(), 'a sentence').toBeNull();
    await type(input, 'zzzz');
    expect.soft(listbox(), 'no match').toBeNull();
    await type(input, '');
    expect.soft(listbox(), 'empty').toBeNull();
    // R3 forbids an empty state, a "No results" row, and a count — nothing is rendered at all.
    expect.soft(document.body.textContent).not.toMatch(/no results/i);
  });

  it('opens on one word and marks the input expanded', async () => {
    const { input } = mount();
    await type(input, 'm');
    expect.soft(listbox()).not.toBeNull();
    expect.soft(input.getAttribute('aria-expanded')).toBe('true');
    // Set while open and pointing at the real element — the other end of the removal asserted
    // in the Escape case below.
    expect.soft(input.getAttribute('aria-controls')).toBe(listbox().id);
    expect.soft(document.getElementById(input.getAttribute('aria-controls'))).not.toBeNull();
  });
});

describe('R5 — two blocks, in order, with the divider where the name block begins', () => {
  it('renders symbol matches then name matches, and marks the boundary once', async () => {
    const { input } = mount();
    await type(input, 'micro'); // all three are NAME matches; no symbol match
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['MSFT', 'MU', 'SMCI']);
    expect.soft(options().filter((o) => o.hasAttribute('data-block-start'))).toHaveLength(0);

    await type(input, 'm'); // MICC, MSFT, MU by symbol; nothing by name at one character (R5)
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['MICC', 'MSFT', 'MU']);
    expect.soft(options().filter((o) => o.hasAttribute('data-block-start'))).toHaveLength(0);

    // 'mic' — MICC by symbol, then MICROSOFT / Micron / Super Micro by name. The one fixture
    // query with BOTH blocks, so it is the only one that can exercise the divider at all.
    await type(input, 'mic');
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['MICC', 'MSFT', 'MU', 'SMCI']);
    const marked = options().filter((o) => o.hasAttribute('data-block-start'));
    expect.soft(marked, 'exactly one divider, never two').toHaveLength(1);
    expect.soft(options().indexOf(marked[0]), 'drawn where the name block begins').toBe(1);
    // The rule is a pseudo-element, never an extra child: a listbox's children must all be
    // role="option" or a screen reader meets a node it has to be told to ignore.
    expect.soft([...listbox().children].every((c) => c.getAttribute('role') === 'option')).toBe(true);
  });

  it('shows the symbol and the name in every row', async () => {
    const { input } = mount();
    await type(input, 'nv');
    expect.soft(options()[0].textContent).toContain('NVDA');
    expect.soft(options()[0].textContent).toContain('NVIDIA CORP');
  });
});

describe('R7 — nothing is highlighted when the list opens', () => {
  it('leaves aria-activedescendant unset until the user arrows onto an option', async () => {
    const { input } = mount();
    await type(input, 'm');
    expect.soft(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect.soft(options().every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);

    press(input, 'ArrowDown');
    expect.soft(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);
    expect.soft(options()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('does not swallow Enter when nothing is active — the typed value reaches the form', async () => {
    const { input } = mount();
    await type(input, 'm');
    const event = press(input, 'Enter');
    expect.soft(event.defaultPrevented).toBe(false);
    expect.soft(input.value).toBe('m'); // untouched — no stray option filled it
  });

  it('wraps in both directions and clears the active option on any edit', async () => {
    const { input } = mount();
    await type(input, 'm');
    press(input, 'ArrowUp'); // from nothing active, up lands on the last
    expect.soft(input.getAttribute('aria-activedescendant')).toBe(options()[2].id);
    press(input, 'ArrowDown');
    expect.soft(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);

    await type(input, 'ms'); // an edit can never leave a stale option active
    expect.soft(input.hasAttribute('aria-activedescendant')).toBe(false);
  });
});

describe('R6 — selecting fills the field and never submits', () => {
  it('fills with the bare symbol, prevents the keydown, and returns focus, on Enter', async () => {
    const { input, form } = mount();
    const submit = vi.fn((e) => e.preventDefault());
    form.addEventListener('submit', submit);

    await type(input, 'm');
    press(input, 'ArrowDown');
    const event = press(input, 'Enter');

    expect.soft(event.defaultPrevented, 'R6: the keydown must be prevented').toBe(true);
    expect.soft(submit, 'R6: selecting must never submit').not.toHaveBeenCalled();
    expect.soft(input.value).toBe('MICC'); // the FIRST option — one ArrowDown from nothing active
    expect.soft(document.activeElement).toBe(input);
    expect.soft(listbox(), 'the list closes on select').toBeNull();
  });

  it('leaves the option in place on mousedown — it selects on click, so a tap cannot fall through', async () => {
    // The failure this guards: selecting inside `mousedown` removes the option synchronously, and
    // `preventDefault` on mousedown does NOT suppress the click that follows. On the stacked
    // mobile layout the first option sits almost exactly over the "Get the read" submit button, so
    // a torn-down option leaves the tap's own click to hit-test onto that button and GET /go/try —
    // a read nobody assented to. jsdom never synthesizes a click from a dispatched mousedown, so
    // the tap-through itself is unobservable here; what IS observable, and what makes it
    // impossible, is that the listbox is still standing when mousedown returns.
    const { input } = mount();
    await type(input, 'm');
    const target = options()[1]; // MSFT

    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    target.dispatchEvent(down);
    expect.soft(down.defaultPrevented, 'mousedown default prevented, so the field never blurs').toBe(true);
    expect.soft(listbox(), 'the listbox must SURVIVE mousedown — nothing to fall through to').not.toBeNull();
    expect.soft(target.isConnected, 'the option is still under the pointer at click time').toBe(true);
    expect.soft(input.value, 'mousedown must not select').toBe('m');
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['MICC', 'MSFT', 'MU']);
  });

  it('fills and never submits on pointer select, keeping focus in the field', async () => {
    const { input, form } = mount();
    const submit = vi.fn((e) => e.preventDefault());
    form.addEventListener('submit', submit);

    await type(input, 'm');
    options()[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect.soft(submit, 'R6: selecting must never submit').not.toHaveBeenCalled();
    expect.soft(input.value).toBe('MSFT'); // options()[1] — the second row of the 'm' symbol block
    expect.soft(document.activeElement).toBe(input);
    expect.soft(listbox(), 'the list closes once the click has landed').toBeNull();
  });
});

describe('R2/R7 — Escape closes without clearing, and is not a mode', () => {
  it('closes on Escape, keeps the value, and reopens on the next edit', async () => {
    const { input } = mount();
    await type(input, 'm');
    const escape = press(input, 'Escape');
    expect.soft(escape.defaultPrevented).toBe(true);
    expect.soft(listbox()).toBeNull();
    expect.soft(input.value, 'Escape closes the list, it does not clear the field').toBe('m');
    expect.soft(input.getAttribute('aria-expanded')).toBe('false');
    // aria-controls must be REMOVED on close, not merely absent before first open: R3 deletes the
    // listbox element, so a retained IDREF would point at nothing after every close — a broken
    // reference some screen readers report.
    expect.soft(input.hasAttribute('aria-controls'), 'no dangling IDREF after a close').toBe(false);

    await type(input, 'ms');
    expect.soft(listbox(), 'an edit reopens — the close was not a mode').not.toBeNull();
  });

  it('leaves Escape to the browser when the list is already closed', async () => {
    const { input } = mount();
    await type(input, 'zzzz'); // nothing open
    expect.soft(press(input, 'Escape').defaultPrevented).toBe(false);
  });
});

describe('progressive enhancement — the plain form survives a missing field', () => {
  it('returns null and touches nothing when the input is absent', () => {
    document.body.innerHTML = '<form id="entry-form"></form>';
    expect(() => createSymbolCombobox({ input: null, loadIndex: vi.fn() })).not.toThrow();
  });
});
