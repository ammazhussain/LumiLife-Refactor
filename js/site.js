// Scroll stage: hero -> exploded anatomy. One scroll value, three eased phases.
// ponytail: plain rAF scroll read, no library. Swap for CSS scroll-timeline once Safari ships it.
(function () {
  var stage = document.querySelector('.stage');
  if (!stage) return;

  var root = document.documentElement;
  var queued = false;

  // map p into [a,b] -> 0..1, then ease
  function phase(p, a, b) {
    var t = (p - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t); // smoothstep
  }

  function update() {
    queued = false;
    var travel = stage.offsetHeight - window.innerHeight;
    if (travel <= 0) return;
    var p = -stage.getBoundingClientRect().top / travel;
    p = p < 0 ? 0 : p > 1 ? 1 : p;

    root.style.setProperty('--p1', phase(p, 0.12, 0.58)); // glasses come apart
    root.style.setProperty('--p2', phase(p, 0.08, 0.34)); // hero copy leaves
    root.style.setProperty('--p3', phase(p, 0.26, 0.50)); // anatomy copy arrives
  }

  function onScroll() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
})();

// The canvas section is chrome-free: the nav steps aside while it is on screen.
(function () {
  var canvas = document.querySelector('.canvas');
  var nav = document.querySelector('.nav');
  if (!canvas || !nav) return;
  new IntersectionObserver(
    function (entries) {
      nav.classList.toggle('is-hidden', entries[0].isIntersecting);
    },
    { threshold: 0.35 }
  ).observe(canvas);
})();
