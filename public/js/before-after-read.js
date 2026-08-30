// Progressive enhancement ONLY — both states are reachable via the tab buttons with this
// script absent (they'd just require a manual click instead of auto-cycling).
//
// Externalized verbatim from src/components/BeforeAfterRead.astro's `is:inline` block so the
// site's CSP can keep `script-src 'self'` strict with no inline exception
// (stock-analyst-platform#2976, consult 0811 Amendment 1).
// This body performs no network call of any kind and reads no field value.
// ci/check-entry-box.mjs scans it as a declared external bundle now, exactly as it scanned
// it inline before — and that scan is textual, so the barred call names must not appear
// here even inside a comment.
(function () {
  var card = document.getElementById("xfCard");
  var tabOpen = document.getElementById("xfTabOpen");
  var tabConn = document.getElementById("xfTabConn");
  if (!card || !tabOpen || !tabConn) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timer = null;
  var onScreen = true;
  var held = false;
  var connected = false;

  function set(next) {
    connected = next;
    card.classList.toggle("is-conn", connected);
    tabConn.classList.toggle("is-on", connected);
    tabOpen.classList.toggle("is-on", !connected);
    tabConn.setAttribute("aria-selected", String(connected));
    tabOpen.setAttribute("aria-selected", String(!connected));
  }
  function restart() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (!reduced && !held && onScreen) set(!connected);
    }, 5000);
  }
  function pick(next) {
    set(next);
    restart();
  }

  tabOpen.addEventListener("click", function () { pick(false); });
  tabConn.addEventListener("click", function () { pick(true); });
  card.addEventListener("mouseenter", function () { held = true; });
  card.addEventListener("mouseleave", function () { held = false; });
  var tabs = document.querySelector('[aria-label="Show the read with or without a connection"]');
  if (tabs) {
    tabs.addEventListener("mouseenter", function () { held = true; });
    tabs.addEventListener("mouseleave", function () { held = false; });
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (rows) {
        rows.forEach(function (r) { onScreen = r.isIntersecting; });
      },
      { rootMargin: "80px" },
    ).observe(card);
  }

  set(false);
  restart();
})();
