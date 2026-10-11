/**
 * Block script for "The overnight call calculator" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to
 * public/js/blog-call.js. It reads the page's own number and slider fields, runs the shared engine and writes the
 * same sentences the build printed (call-view.mjs) back into the page. Nothing is sent, stored or read from the
 * address; the three finds are kept in memory for the visit.
 */
import { DEFAULTS, PRESETS, applyPreset, findsMet, heatGrid, presetMatches, runOvernight, validateInputs } from "../overnight-call.mjs";
import { breakEvenHtml, breakEvenMarker, findsHtml, headlineHtml, heatHtml, pricedHtml, sentenceHtml, sliderText, summaryHtml, waterfallLabel, waterfallSvg, whyHtml } from "../call-view.mjs";

const TYPED = [
  ["t-s", "stock"],
  ["t-k", "strike"],
  ["t-d", "daysToExpiry"],
  ["t-ivb", "ivNowPct"],
];
const SLIDERS = [
  ["t-m", "movePct", "move"],
  ["t-iva", "ivAfterPct", "iv"],
  ["t-dd", "daysPass", "days"],
];

/** @param {Element} root the [data-call] element */
export function init(root, opts = {}) {
  const q = (s) => root.querySelector(s);
  const el = (id) => root.querySelector("#" + id);
  const controls = q("[data-controls]");
  const svg = q("[data-wf]");
  if (!controls || !svg || !el("t-m")) return null;
  const reduceMotion = opts.reduceMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  const found = [false, false, false];
  let last = null;

  q("[data-nojs]") && (q("[data-nojs]").hidden = true);
  controls.hidden = false;

  const num = (id) => parseFloat(el(id).value);

  function render(r) {
    const { inputs } = r;
    const text = sliderText(r);
    for (const [id, , k] of SLIDERS) {
      el(id + "-v").textContent = text[k].value;
      const e = el(id + "-e");
      e.className = "eff " + text[k].tone;
      e.textContent = text[k].effect;
    }
    const mk = el("tbemk");
    const m = breakEvenMarker(r);
    mk.hidden = !m;
    if (m) {
      mk.style.left = m.left;
      mk.textContent = m.text;
    }
    q("[data-sum]").innerHTML = summaryHtml(r);
    q("[data-head]").innerHTML = headlineHtml(r);
    q("[data-sent]").innerHTML = sentenceHtml(r);
    q("[data-be]").innerHTML = breakEvenHtml(r);
    q("[data-why]").innerHTML = whyHtml(r);
    q("[data-em]").innerHTML = pricedHtml(r);
    findsMet(inputs, r).forEach((hit, i) => hit && (found[i] = true));
    q("[data-finds]").innerHTML = findsHtml(found);
    q("[data-fc]").textContent = `· ${found.filter(Boolean).length} of 3 found`;
    q("[data-heat]").innerHTML = heatHtml(heatGrid(inputs, r), inputs, true);
    const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 600));
    svg.setAttribute("viewBox", `0 0 ${W} 270`);
    svg.innerHTML = waterfallSvg(r, W);
    svg.setAttribute("aria-label", waterfallLabel(r));
    root.querySelectorAll(".chip[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(presetMatches(inputs, PRESETS[+b.dataset.p]))));
  }

  function run() {
    const raw = {};
    for (const [id, key] of TYPED) raw[key] = num(id);
    const check = validateInputs(raw);
    for (const [id, key] of TYPED) {
      const bad = Boolean(check.errors[key]);
      el(id).setAttribute("aria-invalid", String(bad));
      const note = el(id + "-x");
      note.hidden = !bad;
      note.textContent = bad ? check.errors[key] : "";
    }
    q("[data-bad]").hidden = check.ok;
    if (!check.ok) {
      q("[data-fold]").open = true;
      return;
    }
    const days = el("t-dd");
    days.max = String(Math.floor(raw.daysToExpiry));
    if (+days.value > raw.daysToExpiry) days.value = String(Math.floor(raw.daysToExpiry));
    for (const [id, key] of SLIDERS) raw[key] = num(id);
    const r = runOvernight(raw);
    if (!r.ok) return;
    last = r;
    render(r);
  }

  controls.addEventListener("input", (e) => e.target.matches && e.target.matches("input") && run());
  root.addEventListener("click", (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const step = t.closest(".stp");
    if (step && root.contains(step)) {
      const input = el(step.dataset.for);
      step.dataset.d === "1" ? input.stepUp() : input.stepDown();
      return run();
    }
    const chip = t.closest(".chip[data-p]");
    if (chip) {
      const ivNow = num("t-ivb");
      const v = applyPreset(PRESETS[+chip.dataset.p], Number.isFinite(ivNow) ? ivNow : DEFAULTS.ivNowPct);
      el("t-m").value = String(v.movePct);
      el("t-iva").value = String(v.ivAfterPct);
      el("t-dd").value = String(v.daysPass);
      return run();
    }
    if (t.closest("[data-reset]")) {
      for (const [id, key] of [...TYPED, ...SLIDERS]) el(id).value = String(DEFAULTS[key]);
      return run();
    }
    pick(t.closest(".hc[data-m]"));
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const c = e.target.closest && e.target.closest(".hc[data-m]");
      if (c) {
        e.preventDefault();
        pick(c);
      }
    }
  });
  function pick(cell) {
    if (!cell) return;
    el("t-m").value = cell.dataset.m;
    el("t-iva").value = cell.dataset.iv;
    run();
    // The grid is rebuilt by run(); put the keyboard back on the cell that was picked.
    const again = root.querySelector(`.hc[data-m="${cell.dataset.m}"][data-iv="${cell.dataset.iv}"]`);
    again && again.focus({ preventScroll: true });
    q("[data-head]").scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  run();
  return { result: () => last, found: () => found.slice() };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-call]")) init(root);
}
