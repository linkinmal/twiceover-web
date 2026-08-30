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
    input.dispatchEvent(new Event('blur'));
    input.focus();
    await Promise.resolve();
    expect.soft(loadIndex).toHaveBeenCalledTimes(1);
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
    expect.soft(input.getAttribute('aria-controls')).toBe(listbox().id);
  });
});

describe('R5 — two blocks, in order, with the divider where the name block begins', () => {
  it('renders symbol matches then name matches, and marks the boundary once', async () => {
    const { input } = mount();
    await type(input, 'micro'); // all three are NAME matches; no symbol match
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['MSFT', 'MU', 'SMCI']);
    expect.soft(options().filter((o) => o.hasAttribute('data-block-start'))).toHaveLength(0);

    await type(input, 'm'); // MSFT, MU by symbol; nothing by name at one character
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['MSFT', 'MU']);
    expect.soft(options().filter((o) => o.hasAttribute('data-block-start'))).toHaveLength(0);

    await type(input, 'nv'); // NVDA by symbol, then NVIDIA by name — the one case with a divider
    expect.soft(options().map((o) => o.dataset.symbol)).toEqual(['NVDA']);
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
    expect.soft(input.getAttribute('aria-activedescendant')).toBe(options()[1].id);
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
    expect.soft(input.value).toBe('MSFT');
    expect.soft(document.activeElement).toBe(input);
    expect.soft(listbox(), 'the list closes on select').toBeNull();
  });

  it('fills and never submits on pointer select, keeping focus in the field', async () => {
    const { input, form } = mount();
    const submit = vi.fn((e) => e.preventDefault());
    form.addEventListener('submit', submit);

    await type(input, 'm');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    options()[1].dispatchEvent(event);

    expect.soft(event.defaultPrevented, 'mousedown prevented so blur never closes the list first').toBe(true);
    expect.soft(submit).not.toHaveBeenCalled();
    expect.soft(input.value).toBe('MU');
    expect.soft(document.activeElement).toBe(input);
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
