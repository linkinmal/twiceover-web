/**
 * branching-step — the kit part for a page whose reader picks a path (blog-handoff-playables.md section 0 "Branching step",
 * section 3; artifact blog-choose-path-2026-10-16.html). Pure functions, no DOM and no clock: a page hands over a tree of
 * steps and endings, and these functions walk it and write the markup the block script and the build both print.
 * Every branch is the reader's pick, never chance or data. A step has two or three choices; an ending has two or three
 * score tiles. Nothing here names a colour: gain and loss are the page theme's `.pos` and `.neg`.
 *
 * tree = { start, nodes: { [id]: step | ending } }
 *   step   = { kind: "step", sit, q, given, happened?, choices: [{ label, sub, to }] }
 *   ending = { kind: "end", sit, q, happened, tiles: [{ figure, label, tone?: "gain" | "loss" }] }
 * `sit` is the one-line state the map prints for the node. `happened` is the "What happened" line (steps after the first).
 * state = { at, path: [{ at, pick }], found: [endingId] }  (immutable; every move returns a new one)
 */

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 3;
export const MIN_TILES = 2;
export const MAX_TILES = 3;

const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Whole-dollar figures print bare, others to the cent; money is rounded to cents first. The sign is a real minus. */
export function money(n) {
  const c = Math.round(Math.abs(n) * 100) / 100;
  const body = Number.isInteger(c) ? c.toLocaleString("en-US") : c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${body}`;
}
export const signedMoney = (n) => `${Math.round(n * 100) < 0 ? "−" : "+"}${money(n)}`;
/** A per-share price: always two decimals. */
export const price = (n) => `$${(Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** The tile tone for a figure that is a gain or a loss. */
export const toneOf = (n) => (Math.round(n * 100) < 0 ? "loss" : "gain");

/** The limits of the part (spec section 3). Returns every problem found, so a page's test names them all at once. */
export function validateTree(tree) {
  const errors = [];
  const nodes = tree?.nodes ?? {};
  if (!nodes[tree?.start]) return ["the start step does not exist"];
  for (const [id, n] of Object.entries(nodes)) {
    if (n.kind === "step") {
      const k = n.choices?.length ?? 0;
      if (k < MIN_CHOICES || k > MAX_CHOICES) errors.push(`${id}: a step has ${MIN_CHOICES} or ${MAX_CHOICES} choices, not ${k}`);
      for (const c of n.choices ?? []) if (!nodes[c.to]) errors.push(`${id}: choice "${c.label}" leads to a missing node "${c.to}"`);
    } else if (n.kind === "end") {
      const k = n.tiles?.length ?? 0;
      if (k < MIN_TILES || k > MAX_TILES) errors.push(`${id}: an ending has ${MIN_TILES} or ${MAX_TILES} tiles, not ${k}`);
    } else errors.push(`${id}: kind must be "step" or "end"`);
  }
  if (errors.length) return errors;
  // No loop, and every node reachable from the start.
  const seen = new Set();
  const visit = (id, stack) => {
    if (stack.includes(id)) return errors.push(`a path loops back to "${id}"`);
    if (seen.has(id) && nodes[id].kind === "end") return;
    seen.add(id);
    for (const c of nodes[id].choices ?? []) visit(c.to, [...stack, id]);
  };
  visit(tree.start, []);
  for (const id of Object.keys(nodes)) if (!seen.has(id)) errors.push(`${id}: no path reaches it`);
  return errors;
}

export const endingIds = (tree) => Object.keys(tree.nodes).filter((id) => tree.nodes[id].kind === "end");

export const initial = (tree) => ({ at: tree.start, path: [], found: [] });

/** The reader picks choice `i` of the current step. A pick on an ending, or out of range, changes nothing. */
export function pick(tree, s, i) {
  const n = tree.nodes[s.at];
  const c = n.kind === "step" ? n.choices[i] : undefined;
  if (!c) return s;
  const found = tree.nodes[c.to].kind === "end" && !s.found.includes(c.to) ? [...s.found, c.to] : s.found;
  return { at: c.to, path: [...s.path, { at: s.at, pick: i }], found };
}

/** "Back one step": undoes the last pick. The first step has nothing to undo. Endings already found stay found. */
export function back(_tree, s) {
  if (!s.path.length) return s;
  const last = s.path[s.path.length - 1];
  return { at: last.at, path: s.path.slice(0, -1), found: s.found };
}

/** "Try another path": back to the first step. The count of endings reached is kept for this visit. */
export const again = (tree, s) => ({ ...initial(tree), found: s.found });

export const isEnd = (tree, s) => tree.nodes[s.at].kind === "end";
export const hasBack = (_tree, s) => s.path.length > 0;

/** The round line: step number on the left, endings reached on the right; on an ending the left reads "This path ended". */
export function roundLine(tree, s) {
  return {
    left: isEnd(tree, s) ? "This path ended" : `Step ${s.path.length + 1}`,
    right: `Endings reached: ${s.found.length} of ${endingIds(tree).length}`,
  };
}

/** The trail, from step 2 on: the picks so far, in order, as list items. Empty on step 1. */
export function trailHtml(tree, s) {
  return s.path.map((p) => `<li>${esc(tree.nodes[p.at].choices[p.pick].label)}</li>`).join("");
}

/** The step or the ending, as the live region shows it. The heading takes focus after a move (`tabindex="-1"`). */
export function stepHtml(tree, s) {
  const n = tree.nodes[s.at];
  const happened = n.happened ? `<p class="br-happ"><span class="br-tl">What happened</span>${esc(n.happened)}</p>` : "";
  const heading = `<h2 class="q" id="br-q" tabindex="-1">${esc(n.q)}</h2>`;
  const backLink = `<button class="br-skip" type="button" data-br-back>Back one step</button>`;
  if (n.kind === "end") {
    const tiles = n.tiles
      .map((t) => `<div><b${t.tone ? ` class="${t.tone === "gain" ? "pos" : "neg"}"` : ""}>${esc(t.figure)}</b><span>${esc(t.label)}</span></div>`)
      .join("");
    return `${happened}${heading}<div class="br-score">${tiles}</div><div class="row"><button class="btn" type="button" data-br-again>Try another path</button>${backLink}</div>`;
  }
  const choices = n.choices
    .map((c, i) => `<button class="br-choice" type="button" data-br-pick="${i}"><b>${esc(c.label)}</b><span>${esc(c.sub)}</span></button>`)
    .join("");
  return `${happened}${heading}<p class="br-given">${esc(n.given)}</p><div class="br-choices" role="group" aria-label="Your paths">${choices}</div>${hasBack(tree, s) ? `<div class="row">${backLink}</div>` : ""}`;
}

/** The map: every step, pick and ending as an open nested list, "Reached" on the endings found. No graphic. */
export function mapHtml(tree, found = []) {
  const node = (id) => {
    const n = tree.nodes[id];
    if (n.kind === "end") {
      return `<li><b>${esc(n.q)}</b>${found.includes(id) ? '<span class="br-got">Reached</span>' : ""}<br><span class="br-sit">${esc(n.sit)}</span></li>`;
    }
    return `<li><b>${esc(n.sit)}</b><ul>${n.choices.map((c) => `<li><b>${esc(c.label)}</b> →<ul>${node(c.to)}</ul></li>`).join("")}</ul></li>`;
  };
  return `<ul>${node(tree.start)}</ul>`;
}

/**
 * The playing section as the build prints it: hidden until the script shows it (script off prints the terms, the
 * lesson, the whole map and "How it is played" instead). The section is labelled by the step heading (`#br-q`).
 */
export function playHtml(tree) {
  const s = initial(tree);
  const r = roundLine(tree, s);
  return `<section class="blk play" data-br-play aria-labelledby="br-q" hidden><p class="br-rd"><span data-br-left>${esc(r.left)}</span><span data-br-right>${esc(r.right)}</span></p><div data-br-trailwrap hidden><p class="br-tl" id="br-trailh">Your path so far</p><ol class="br-trail" data-br-trail aria-labelledby="br-trailh"></ol></div><div data-br-step aria-live="polite">${stepHtml(tree, s)}</div></section>`;
}
