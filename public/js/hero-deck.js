// The hero deck (stock-analyst-platform#3829; site-prelaunch.md §2 "Hero deck"). Progressive
// enhancement ONLY: the server-rendered markup is already the deck's first state, a static stack.
// This script makes it turn — opening on a random card, advancing every 5s, pausing on hover or
// focus and on the Pause button (WCAG 2.2.2), and never moving at all under reduced motion.
//
// Ported from the build reference's own script (homepage-3818-v3-2026-09-23.html), minus its review
// affordances (a ?front= query override and the mockup's history toggle).
// It reorders elements and sets attributes and text. It reads no form field and opens no network
// connection of any kind; ci/check-entry-box.mjs scans this file as a declared external script, and
// that scan is textual, so the barred call names must not appear here even inside a comment.
(function () {
  "use strict";
  var deck = document.getElementById("deck");
  var ctl = document.getElementById("deckCtl");
  if (!deck || !ctl) return;
  var cards = Array.prototype.slice.call(deck.children).filter(function (c) {
    return c.classList.contains("dcard");
  });
  var dots = Array.prototype.slice.call(ctl.querySelectorAll(".deck-dot"));
  var nameEl = document.getElementById("deckName");
  var pauseBtn = document.getElementById("deckPause");
  var n = cards.length;
  if (n < 2) return;
  var front = Math.floor(Math.random() * n);
  var paused = false;
  var hover = false;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function label() {
    if (nameEl) nameEl.textContent = front + 1 + " / " + n + " · " + cards[front].getAttribute("aria-label");
    dots.forEach(function (d, i) {
      d.setAttribute("aria-current", i === front ? "true" : "false");
    });
  }
  function lay() {
    cards.forEach(function (c, i) {
      c.setAttribute("data-pos", String((i - front + n) % n));
      c.setAttribute("aria-hidden", i === front ? "false" : "true");
    });
    label();
  }
  function next(to) {
    var target = to == null ? (front + 1) % n : to;
    if (reduce) {
      front = target;
      lay();
      return;
    }
    var leaving = cards[front];
    leaving.classList.add("leaving");
    front = target;
    cards.forEach(function (c, i) {
      if (c !== leaving) c.setAttribute("data-pos", String((i - front + n) % n));
    });
    label();
    setTimeout(function () {
      leaving.style.transition = "none";
      leaving.classList.remove("leaving");
      lay();
      void leaving.offsetWidth;
      leaving.style.transition = "";
    }, 700);
  }

  lay();
  ctl.hidden = false;
  var fig = deck.parentNode;
  fig.addEventListener("mouseenter", function () { hover = true; });
  fig.addEventListener("mouseleave", function () { hover = false; });
  fig.addEventListener("focusin", function () { hover = true; });
  fig.addEventListener("focusout", function () { hover = false; });
  pauseBtn.addEventListener("click", function () {
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
    pauseBtn.textContent = paused ? "Play" : "Pause";
  });
  if (reduce) {
    paused = true;
    pauseBtn.textContent = "Play";
    pauseBtn.setAttribute("aria-pressed", "true");
  }
  dots.forEach(function (d, i) {
    d.addEventListener("click", function () {
      if (i !== front) next(i);
    });
  });
  setInterval(function () {
    if (!paused && !hover && !reduce) next();
  }, 5000);
})();
