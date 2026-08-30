// Progressive enhancement ONLY — the analysis band scrolls via CSS (@keyframes band-flow,
// gated to prefers-reduced-motion: no-preference) with no JS at all. This adds one thing on
// top: pausing the animation when the band is off-screen, so it doesn't run unseen (mirrors
// the before/after card's own off-screen pause).
//
// Externalized verbatim from src/components/AnalysisBand.astro's `is:inline` block so the
// site's CSP can keep `script-src 'self'` strict with no inline exception
// (stock-analyst-platform#2976, consult 0811 Amendment 1).
// This body performs no network call of any kind and reads no field value.
// ci/check-entry-box.mjs scans it as a declared external bundle now, exactly as it scanned
// it inline before — and that scan is textual, so the barred call names must not appear
// here even inside a comment.
(function () {
  var track = document.getElementById("bandTrack");
  if (!track || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(
    function (rows) {
      rows.forEach(function (r) {
        track.style.animationPlayState = r.isIntersecting ? "running" : "paused";
      });
    },
    { rootMargin: "80px" },
  ).observe(track);
})();
