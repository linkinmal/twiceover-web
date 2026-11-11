/**
 * branching-step-client — the browser half of the branching step (blog-handoff-playables.md section 3). A page's block
 * script (ADR 1088 Decision 1) imports `mount` and hands it the page root and the tree. The build already printed the
 * lesson, the whole map and "How it is played"; the script shows the playing section, hides "How it is played", and keeps
 * the lesson and the map hidden until the first ending. A tap replaces the step, focus moves to the new heading and the
 * step's polite live region announces it. Nothing is sent, stored or read from the address.
 */
import { again, back, endingIds, initial, mapHtml, pick, roundLine, stepHtml, trailHtml } from "./branching-step.mjs";

/**
 * @param {Element} root holds [data-br-play] (see playHtml), and optionally [data-br-lesson], [data-br-mapblk] with [data-br-map], [data-br-how]
 * @param {object} tree see branching-step.mjs
 */
export function mount(root, tree) {
  const q = (s) => root.querySelector(s);
  const play = q("[data-br-play]");
  const step = q("[data-br-step]");
  if (!play || !step) return null;
  let s = initial(tree);

  function render(focus) {
    const r = roundLine(tree, s);
    q("[data-br-left]").textContent = r.left;
    q("[data-br-right]").textContent = r.right;
    q("[data-br-trail]").innerHTML = trailHtml(tree, s);
    q("[data-br-trailwrap]").hidden = s.path.length === 0;
    step.innerHTML = stepHtml(tree, s);
    const none = s.found.length === 0;
    for (const n of root.querySelectorAll("[data-br-lesson],[data-br-mapblk]")) n.hidden = none;
    const map = q("[data-br-map]");
    if (map) map.innerHTML = mapHtml(tree, s.found);
    if (focus) q("#br-q")?.focus();
  }

  step.addEventListener("click", (e) => {
    const b = e.target.closest?.("button");
    if (!b) return;
    if (b.hasAttribute("data-br-pick")) s = pick(tree, s, Number(b.getAttribute("data-br-pick")));
    else if (b.hasAttribute("data-br-back")) s = back(tree, s);
    else if (b.hasAttribute("data-br-again")) s = again(tree, s);
    else return;
    render(true);
  });

  play.hidden = false;
  for (const n of root.querySelectorAll("[data-br-how]")) n.hidden = true;
  render(false);
  return { state: () => ({ ...s, endings: endingIds(tree).length }) };
}
