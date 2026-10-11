/**
 * Block script for "The overnight call calculator" (ADR 1088 Decision 1, ADR 1090 Decision 8). Bundled to
 * public/js/blog-call.js. It reads the page's own sliders and typed boxes, runs the shared engine and writes the same
 * sentences the build printed (call-view.mjs) back into the page. Nothing is sent, stored or read from the address;
 * the three finds are kept in memory for the visit.
 */
import { DEFAULTS, PRESETS, applyPreset, findsMet, heatGrid, presetMatches, runOvernight, validateInputs } from "../overnight-call.mjs";
import { BAD_NUMBER, readNumber } from "../number-input.mjs";
import { breakEvenHtml, breakEvenMarker, findsHtml, headlineHtml, heatHtml, nightHtml, pricedHtml, sentenceHtml, sliderText, waterfallLabel, waterfallSvg, whyHtml } from "../call-view.mjs";

const TYPED = [
  ["t-k", "strike"],
  ["t-d", "daysToExpiry"],
  ["t-s", "stock"],
  ["t-ivb", "ivNowPct"],
];
const SLIDERS = [
  ["t-m", "movePct", "move"],
  ["t-iva", "ivAfterPct", "iv"],
  ["t-dd", "daysPass", "days"],
];

/** @param {Element} root the [data-call] element */
export function init(root) {
  const q = (s) => root.querySelector(s);
  const el = (id) => root.querySelector("#" + id);
  const svg = q("[data-wf]");
  if (!svg || !el("t-m")) return null;

  const found = [false, false, false];
  let last = null;

  root.querySelectorAll("[data-js]").forEach((n) => (n.hidden = false));
  root.querySelectorAll("[data-nojs]").forEach((n) => (n.hidden = true));

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
      mk.className = "be" + m.side;
      mk.textContent = m.text;
    }
    q("[data-night]").innerHTML = nightHtml(r);
    q("[data-head]").innerHTML = headlineHtml(r);
    q("[data-sent]").innerHTML = sentenceHtml(r);
    q("[data-be]").innerHTML = breakEvenHtml(r);
    q("[data-why]").innerHTML = whyHtml(r);
    q("[data-em]").innerHTML = pricedHtml(r);
    findsMet(inputs, r).forEach((hit, i) => hit && (found[i] = true));
    q("[data-finds]").innerHTML = findsHtml(found);
    q("[data-fc]").textContent = `· ${found.filter(Boolean).length} of 3 found`;
    q("[data-heat]").innerHTML = heatHtml(heatGrid(inputs, r), inputs);
    const W = Math.max(260, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 600));
    svg.setAttribute("viewBox", `0 0 ${W} 270`);
    svg.innerHTML = waterfallSvg(r, W);
    svg.setAttribute("aria-label", waterfallLabel(r));
    root.querySelectorAll(".chip[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(presetMatches(inputs, PRESETS[+b.dataset.p]))));
  }

  function run() {
    const raw = {};
    for (const [id, key] of TYPED) raw[key] = readNumber(el(id).value);
    const check = validateInputs(raw);
    for (const [id, key] of TYPED) {
      const bad = Boolean(check.errors[key]);
      el(id).setAttribute("aria-invalid", String(bad));
      const note = el(id + "-x");
      note.hidden = !bad;
      note.textContent = bad ? check.errors[key] : "";
    }
    q("[data-bad]").textContent = check.ok ? "" : BAD_NUMBER;
    if (!check.ok) return;
    const days = el("t-dd");
    days.max = String(Math.floor(raw.daysToExpiry));
    if (+days.value > raw.daysToExpiry) days.value = String(Math.floor(raw.daysToExpiry));
    for (const [id, key] of SLIDERS) raw[key] = parseFloat(el(id).value);
    const r = runOvernight(raw);
    if (!r.ok) return;
    last = r;
    render(r);
  }

  root.addEventListener("input", (e) => e.target.matches && e.target.matches("input") && run());
  root.addEventListener("click", (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const chip = t.closest(".chip[data-p]");
    if (chip) {
      const ivNow = readNumber(el("t-ivb").value);
      const v = applyPreset(PRESETS[+chip.dataset.p], Number.isFinite(ivNow) ? ivNow : DEFAULTS.ivNowPct);
      el("t-m").value = String(v.movePct);
      el("t-iva").value = String(v.ivAfterPct);
      el("t-dd").value = String(v.daysPass);
      return run();
    }
    if (t.closest("[data-reset]")) {
      for (const [id, key] of TYPED) el(id).value = String(DEFAULTS[key]);
      return run();
    }
  });

  run();
  return { result: () => last, found: () => found.slice() };
}

if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll("[data-call]")) init(root);
}
