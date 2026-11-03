// Scroll stage: hero -> exploded anatomy. One scroll value, three eased phases.
// ponytail: plain rAF scroll read, no library. Swap for CSS scroll-timeline once Safari ships it.
(function () {
  function stage() {
    var panel = document.querySelector('.panel:not([hidden]):not(.is-leaving)');
    return panel && panel.querySelector('.stage');
  }
  if (!stage()) return;

  var root = document.documentElement;
  var queued = false;

  // map p into [a,b] -> 0..1, then ease
  function phase(p, a, b) {
    var t = (p - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t); // smoothstep
  }

  // --- scrubbed disassembly ------------------------------------------------
  // The clip carries its own choreography -- slow orbit, then the parts fly
  // apart over its frames 88-112 of 232, then the camera drifts on to the
  // final angle. So it is driven LINEARLY off raw p: easing it again would
  // squeeze that burst into no scroll at all.
  //
  // VID_OUT 0.56 puts the burst at p 0.21-0.27, just as the hero copy finishes
  // leaving (p2 ends 0.34), and leaves the clip holding its last frame from
  // 0.56 on. The callouts only reach full opacity at 0.62, by which point the
  // render has stopped and the dots are exactly on their parts.
  // ponytail: these three are the tuning knobs. Everything else is geometry.
  var VID_OUT = 0.56, P3_IN = 0.42, P3_OUT = 0.62;

  var vid = null, pending = -1;

  function flush() {
    if (pending < 0 || !vid) return;
    var t = pending; pending = -1;
    vid.currentTime = t;
  }

  function scrub(st, p) {
    var v = st.querySelector('.product__vid');
    if (!v || !v.duration) return false;
    if (v !== vid) { vid = v; v.addEventListener('seeked', flush); }
    // last frame, not duration: seeking to duration itself lands past the end
    // and Chrome serves the frame before it, which reads as a one-frame jitter.
    var t = Math.min(p / VID_OUT, 1) * (v.duration - 1 / 24);
    if (v.seeking) { pending = t; } else { pending = -1; v.currentTime = t; }
    return true;
  }

  function update() {
    queued = false;
    var st = stage();
    if (!st) return;
    var travel = st.offsetHeight - window.innerHeight;
    if (travel <= 0) return;
    var p = -st.getBoundingClientRect().top / travel;
    p = p < 0 ? 0 : p > 1 ? 1 : p;

    var scrubbed = root.classList.contains('has-scrub') && scrub(st, p);

    root.style.setProperty('--p1', phase(p, 0.12, 0.58)); // glasses come apart
    root.style.setProperty('--p2', phase(p, 0.08, 0.34)); // hero copy leaves
    root.style.setProperty('--p3', scrubbed                // anatomy copy arrives
      ? phase(p, P3_IN, P3_OUT)
      : phase(p, 0.26, 0.50));
  }

  // Switch the scrub on only once the clip really scrubs, and only on the
  // layout it was composed for. Every other path keeps the PNG crossfade,
  // which needs nothing from this block to work.
  //
  // The probe seek is the whole point of this function. 'loadeddata' only says
  // the container parsed -- a browser with no H.264 decoder still fires it,
  // reports duration and videoWidth, and then paints nothing. Trusting it
  // swaps a working render for a white rectangle. So: ask for a frame, and
  // only take over if currentTime actually went there.
  (function enable() {
    var v = document.querySelector('.product__vid');
    if (!v) return;
    if (!matchMedia('(min-width:1100px)').matches) return;
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

    // The element ships with no src at all: every path that keeps the PNGs --
    // narrow, reduced motion, no decoder -- must not pay 1.9MB for a clip it
    // will never show, and phones are exactly the narrow path.
    v.preload = 'auto';
    v.src = v.dataset.src;

    v.addEventListener('loadeddata', function () {
      var probe = 1 / 24;
      v.currentTime = probe;
      setTimeout(function () {
        if (v.currentTime < probe / 2) {        // never got there -- keep the PNGs
          // Loudly, because the usual cause in dev is a static server that
          // answers Range with a plain 200 (python -m http.server does), and
          // nothing else on the page goes wrong to point at it.
          if (v.seekable.length && v.seekable.end(0) === 0) {
            console.warn('scrub off: the server is not serving byte ranges, ' +
                         'so the clip is not seekable. Use ./serve.py.');
          }
          return;
        }
        root.classList.add('has-scrub');
        update();
      }, 400);
    }, { once: true });
  })();

  function onScroll() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
})();

// Past the two stage sections the product toggle has nothing to control, so it
// leaves. A Set of what is currently on screen, rather than a counter — the
// observer's first callback reports every target at once, which makes += / -=
// bookkeeping drift immediately.
(function () {
  // every section that is not a stage: add new ones here, or the toggle
  // reappears over content it does not control
  var past = [].slice.call(document.querySelectorAll('main > section'));
  if (!past.length) return;
  var showing = new Set();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) showing.add(e.target); else showing.delete(e.target);
    });
    document.body.classList.toggle('past-stages', showing.size > 0);
  }, { threshold: 0.06 });
  past.forEach(function (el) { io.observe(el); });
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

// Product tabs: same page, one product at a time. Switching always lands on
// the new product's FIRST section — nobody arrives mid-teardown at a product
// whose pitch they have not read yet. The jump is instant and happens while
// the outgoing panel still covers the viewport at full opacity, so it is never
// seen; animating it instead would run the incoming stage's phases backwards
// and play the teardown in reverse.
// ponytail: two classes and a timeout; no view transitions, no library.
(function () {
  var tabs = [].slice.call(document.querySelectorAll('[role="tab"]'));
  if (!tabs.length) return;

  var OUT = 300; // ms; panel-out is .28s, this clears it

  // A switch fired mid-switch must finish the previous one first, or its
  // timeout hides a panel we have since re-shown.
  var pendingFn = null, pendingId = 0;
  function flush() {
    if (!pendingFn) return;
    clearTimeout(pendingId);
    pendingFn();
    pendingFn = null;
  }

  function select(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });

    flush();
    var next = document.getElementById(tab.getAttribute('aria-controls'));
    var current = document.querySelector('.panel:not([hidden]):not(.is-leaving)');
    if (!next || next === current) return;

    if (current) {
      // freeze it as a one-viewport snapshot: out of flow and fixed, so the
      // jump below slides underneath it instead of taking it along
      current.classList.add('is-leaving');
      pendingFn = function () {
        current.classList.remove('is-leaving');
        current.hidden = true;
      };
      pendingId = setTimeout(flush, OUT);
    }
    next.hidden = false;
    // Unhide first, THEN scroll: the document is already back to full height,
    // so the browser never clamps the offset against a collapsed page. Both
    // happen in one task, so no frame is painted in between.
    // 'instant' is required — html{scroll-behavior:smooth} would otherwise
    // animate this and put the reverse-teardown straight back.
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.dispatchEvent(new Event('scroll'));
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { select(t); });
  });

  // left/right arrows move between tabs, as a tablist should
  tabs.forEach(function (t, i) {
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var nextTab = tabs[(i + d + tabs.length) % tabs.length];
      nextTab.focus();
      select(nextTab);
    });
  });
})();

// Cart. In-memory only: there is no backend, nothing persists across a reload,
// and Checkout is inert. One source of truth (`lines`) drives the badge, the
// drawer and the subtotal, so they cannot disagree.
// ponytail: a plain object and one render(); no store, no framework.
(function () {
  var triggers = [].slice.call(document.querySelectorAll('[data-add-to-cart]'));
  var cartLink = document.querySelector('.nav__cart');
  var drawer = document.querySelector('.cart');
  if (!triggers.length || !cartLink || !drawer) return;

  var panel = drawer.querySelector('.cart__panel');
  var list = drawer.querySelector('.cart__items');
  var empty = drawer.querySelector('.cart__empty');
  var sum = drawer.querySelector('.cart__sum');
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  var lines = {};          // name -> { name, price, img, qty }
  var lastFocus = null;

  function money(n) { return '€' + n.toLocaleString('en-IE'); }

  function render() {
    var names = Object.keys(lines);
    var count = 0, total = 0;

    list.innerHTML = '';
    names.forEach(function (name) {
      var l = lines[name];
      count += l.qty;
      total += l.qty * l.price;

      var li = document.createElement('li');
      li.className = 'cart__row';
      li.innerHTML =
        '<span class="cart__thumb"><img src="' + l.img + '" alt=""></span>' +
        '<span><span class="cart__name"></span>' +
        '<span class="cart__line">' + money(l.price) + ' each</span></span>' +
        '<span class="cart__qty">' +
          '<button class="cart__step" type="button" data-step="-1" aria-label="One fewer ' + name + '">−</button>' +
          '<span class="cart__n">' + l.qty + '</span>' +
          '<button class="cart__step" type="button" data-step="1" aria-label="One more ' + name + '">+</button>' +
        '</span>';
      // textContent, not innerHTML — the name is data, never markup
      li.querySelector('.cart__name').textContent = name;
      li.querySelectorAll('[data-step]').forEach(function (b) {
        b.addEventListener('click', function () { bump(name, +b.dataset.step); });
      });
      list.appendChild(li);
    });

    empty.hidden = count > 0;
    sum.textContent = money(total);
    if (count) { cartLink.dataset.count = count; } else { delete cartLink.dataset.count; }
    cartLink.setAttribute('aria-label', 'Cart, ' + count + (count === 1 ? ' item' : ' items'));
  }

  function bump(name, by) {
    var l = lines[name];
    if (!l) return;
    l.qty += by;
    if (l.qty < 1) delete lines[name];
    render();
  }

  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.classList.add('cart-open');
    requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    panel.querySelector('.cart__close').focus();
  }

  function close() {
    drawer.classList.remove('is-open');
    document.body.classList.remove('cart-open');
    var done = function () { drawer.hidden = true; };
    if (still.matches) done();
    else panel.addEventListener('transitionend', function once() {
      panel.removeEventListener('transitionend', once); done();
    });
    if (lastFocus) lastFocus.focus();
  }

  function fly(img) {
    if (still.matches || !img || !img.complete) return;
    var from = img.getBoundingClientRect();
    var to = cartLink.getBoundingClientRect();

    var ghost = img.cloneNode();
    ghost.className = 'fly';
    ghost.style.left = from.left + 'px';
    ghost.style.top = from.top + 'px';
    ghost.style.width = from.width + 'px';
    ghost.style.height = from.height + 'px';
    document.body.appendChild(ghost);

    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);

    ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      // arc upward through the middle, so it reads as thrown rather than slid
      { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.45 - 70) + 'px) scale(.46)',
        opacity: .85, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.06)', opacity: 0 }
    ], { duration: 760, easing: 'cubic-bezier(.38,0,.22,1)' }).onfinish = function () {
      ghost.remove();
      cartLink.classList.add('is-hit');
      setTimeout(function () { cartLink.classList.remove('is-hit'); }, 360);
    };
  }

  triggers.forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.dataset.addToCart;
      var card = b.closest('.card');
      var img = card && card.querySelector('img');

      if (lines[name]) lines[name].qty++;
      else lines[name] = { name: name, price: +b.dataset.price, img: img ? img.src : '', qty: 1 };
      render();

      fly(img);
      b.classList.add('is-added');
      setTimeout(function () { b.classList.remove('is-added'); }, 1400);
    });
  });

  cartLink.addEventListener('click', function (e) { e.preventDefault(); open(); });
  drawer.addEventListener('click', function (e) { if (e.target.closest('[data-cart-close]')) close(); });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hidden) close();
  });

  render();
})();

// Before/after marquee: a constant crawl you can grab, that coasts on released
// momentum and then resumes. rAF rather than a CSS keyframe, because a keyframe
// cannot be grabbed mid-flight and cannot hand its position to a drag.
// ponytail: ~50 lines of physics, no slider library.
(function () {
  var track = document.querySelector('.marquee__track');
  if (!track) return;

  var SPEED = 0.8;        // px per frame of idle crawl
  var DECAY = 0.95;       // momentum falloff after release
  var still = matchMedia('(prefers-reduced-motion: reduce)');

  // duplicate the strip so the wrap at half-width is invisible; the markup
  // stays one copy
  var originals = [].slice.call(track.children);
  originals.forEach(function (li) {
    var c = li.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    track.appendChild(c);
  });

  var offset = 0, velocity = 0, dragging = false;
  var startX = 0, startOffset = 0, lastX = 0, lastT = 0;
  var raf = null;

  function frame() {
    if (!dragging) {
      if (Math.abs(velocity) > 0.1) { offset += velocity; velocity *= DECAY; }
      else { velocity = 0; if (!still.matches) offset -= SPEED; }
    }
    var half = track.scrollWidth / 2;
    if (half > 0) {
      if (offset <= -half) offset += half;
      if (offset > 0) offset -= half;
    }
    track.style.transform = 'translate3d(' + offset + 'px,0,0)';
    raf = requestAnimationFrame(frame);
  }

  track.addEventListener('pointerdown', function (e) {
    dragging = true; velocity = 0;
    startX = lastX = e.clientX; startOffset = offset; lastT = performance.now();
    track.setPointerCapture(e.pointerId);
    track.classList.add('is-grabbing');
  });

  track.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var t = performance.now();
    var dt = t - lastT || 16;
    velocity = ((e.clientX - lastX) / dt) * 16;   // normalise to ~60fps
    lastX = e.clientX; lastT = t;
    offset = startOffset + (e.clientX - startX);
  });

  function release(e) {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-grabbing');
    if (e.pointerId !== undefined && track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
  }
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  // never burn frames on a strip nobody is looking at
  new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
    else if (raf) { cancelAnimationFrame(raf); raf = null; }
  }, { threshold: 0.05 }).observe(track);
})();

// Reveal footer: the wrapper has to be exactly as tall as the fixed footer it
// is revealing. CSS cannot measure that, so it is set here — and re-set when
// the footer reflows, which it does on resize and when the webfonts land.
(function () {
  var wrap = document.querySelector('.revealwrap');
  var footer = wrap && wrap.querySelector('.footer');
  if (!footer) return;

  function fit() { wrap.style.height = footer.offsetHeight + 'px'; }
  fit();
  addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(footer);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();

// The phone lifts in when the section arrives. Once only — a thing that
// re-animates every time you scroll past reads as a glitch, not a flourish.
(function () {
  var app = document.querySelector('.app');
  if (!app) return;
  var io = new IntersectionObserver(function (e) {
    if (!e[0].isIntersecting) return;
    app.classList.add('is-in');
    io.disconnect();
  }, { threshold: 0.25 });
  io.observe(app);
})();

// The support card hangs as a pinned sheet you can grab and tug, and the text
// is PRINTED INTO the cloth so it creases with it. Verlet points on a 2D
// canvas; the print is an offscreen canvas, texture-mapped per triangle.
// ponytail: 2D affine mapping per triangle, not WebGL — ~240 triangles at this
// size costs about a millisecond and needs no shader pipeline.
(function () {
  var host = document.querySelector('[data-sheet]');
  if (!host) return;
  var cv = host.querySelector('.sheet__cloth');
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var COLS = 13, ROWS = 11, ITER = 3, GRAV = 1500, DAMP = 0.986, GRAB = 0.16;
  var OLIVE = '#2E3D28', SAGE = '#A9B887';
  var still = matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0, H = 0, dpr = 1, sx = 0, sy = 0, padX = 0, padY = 0;
  var P = [], L = [], pinA = null, pinB = null, print = document.createElement('canvas');
  var held = null, pointerId = null, hx = 0, hy = 0;
  var raf = null, onScreen = false, last = 0;

  function idx(c, r) { return r * COLS + c; }

  // ---- the print -----------------------------------------------------------
  function paint() {
    print.width = Math.max(1, Math.round(W * dpr));
    print.height = Math.max(1, Math.round(H * dpr));
    var g = print.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = OLIVE;
    g.fillRect(0, 0, W, H);

    var pad = W * 0.12;
    if ('letterSpacing' in g) g.letterSpacing = '0.16em';
    g.fillStyle = 'rgba(169,184,135,.6)';
    g.font = '500 ' + (W * 0.026).toFixed(1) + 'px ui-monospace, Consolas, monospace';
    g.fillText('SUPPORT', pad, H * 0.16);
    if ('letterSpacing' in g) g.letterSpacing = '0px';

    // the motto echoes the product itself: you ask Lumi out loud
    g.fillStyle = SAGE;
    var fs = W * 0.092;
    g.font = '400 ' + fs.toFixed(1) + 'px "Clash Display", Georgia, serif';
    ['Ask us', 'anything.', 'Out loud,', 'if you like.'].forEach(function (line, i) {
      g.fillText(line, pad, H * 0.29 + i * fs * 1.08);
    });

    g.strokeStyle = 'rgba(169,184,135,.26)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(pad, H * 0.72);
    g.lineTo(W - pad, H * 0.72);
    g.stroke();

    g.font = '400 ' + (W * 0.038).toFixed(1) + 'px "Satoshi", system-ui, sans-serif';
    g.fillStyle = 'rgba(169,184,135,.8)';
    g.fillText('Based in Berlin', pad, H * 0.785);
    // masked deliberately: a plausible-looking number is somebody's real number
    g.fillStyle = 'rgba(169,184,135,.48)';
    g.fillText('+49 30 •••• ••••', pad, H * 0.845);
  }

  // ---- cloth ---------------------------------------------------------------
  function build() {
    var box = host.getBoundingClientRect();
    W = box.width; H = box.height;
    if (!W || !H) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();

    padX = W * 0.05; padY = H * 0.04;
    sx = (W - padX * 2) / (COLS - 1);
    sy = (H - padY * 2) / (ROWS - 1) * 0.94;

    P = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = padX + c * sx, y = padY + r * sy;
      P.push({ x: x, y: y, px: x, py: y, pin: r === 0 && (c === 0 || c === COLS - 1) });
    }
    // Structural, shear and bend links, built once off the rest shape.
    // Structural alone has no shear resistance: one hard yank folds the grid
    // flat and it never recovers. The diagonals are what let it spring back.
    L = [];
    function add(i, jj, k) {
      var a = P[i], b = P[jj];
      L.push({ a: a, b: b, rest: Math.hypot(b.x - a.x, b.y - a.y), k: k });
    }
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      if (c2 < COLS - 1) add(idx(c2, r2), idx(c2 + 1, r2), 1);
      if (r2 < ROWS - 1) add(idx(c2, r2), idx(c2, r2 + 1), 1);
      if (c2 < COLS - 1 && r2 < ROWS - 1) {          // shear
        add(idx(c2, r2), idx(c2 + 1, r2 + 1), 0.45);
        add(idx(c2 + 1, r2), idx(c2, r2 + 1), 0.45);
      }
      if (c2 < COLS - 2) add(idx(c2, r2), idx(c2 + 2, r2), 0.22);   // bend
      if (r2 < ROWS - 2) add(idx(c2, r2), idx(c2, r2 + 2), 0.22);
    }
    pinA = P[idx(0, 0)]; pinB = P[idx(COLS - 1, 0)];
    for (var i2 = 0; i2 < P.length; i2++) {
      P[i2].ta = Math.hypot(P[i2].x - pinA.x, P[i2].y - pinA.y) * 1.04;
      P[i2].tb = Math.hypot(P[i2].x - pinB.x, P[i2].y - pinB.y) * 1.04;
    }
    settle(260);
  }

  function relax() {
    for (var k = 0; k < ITER; k++) {
      for (var i = 0; i < L.length; i++) {
        var l = L[i], a = l.a, b = l.b;
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.hypot(dx, dy) || 0.0001;
        var f = (d - l.rest) / d * 0.5 * l.k, ox = dx * f, oy = dy * f;
        if (!a.pin && a !== held) { a.x += ox; a.y += oy; }
        if (!b.pin && b !== held) { b.x -= ox; b.y -= oy; }
      }
      tether();
    }
  }

  // no point may drift further from either pin than its rest distance + 4%.
  // this is what stops a hard drag from stretching the sheet into a streamer.
  function tether() {
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.pin || p === held) continue;
      clamp(p, pinA, p.ta);
      clamp(p, pinB, p.tb);
    }
  }
  function clamp(p, pin, max) {
    var dx = p.x - pin.x, dy = p.y - pin.y;
    var d = Math.hypot(dx, dy);
    if (d > max && d > 0) { var s = max / d; p.x = pin.x + dx * s; p.y = pin.y + dy * s; }
  }

  function step(h) {
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.pin || p === held) { p.px = p.x; p.py = p.y; continue; }
      var vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + GRAV * h * h;
    }
    relax();
  }

  function settle(n) { var h = 1 / 120; for (var i = 0; i < n; i++) step(h); }

  // ---- texture-mapped render ----------------------------------------------
  // one affine map per triangle: the only way 2D canvas can warp an image
  function tri(s0, s1, s2, d0, d1, d2) {
    var den = s0.u * (s2.v - s1.v) - s1.u * s2.v + s2.u * s1.v + (s1.u - s2.u) * s0.v;
    if (!den) return;
    var a = -(s0.v * (d2.x - d1.x) - s1.v * d2.x + s2.v * d1.x + (s1.v - s2.v) * d0.x) / den;
    var b = (s1.v * d2.y + s0.v * (d1.y - d2.y) - s2.v * d1.y + (s2.v - s1.v) * d0.y) / den;
    var c = (s0.u * (d2.x - d1.x) - s1.u * d2.x + s2.u * d1.x + (s1.u - s2.u) * d0.x) / den;
    var d = -(s1.u * d2.y + s0.u * (d1.y - d2.y) - s2.u * d1.y + (s2.u - s1.u) * d0.y) / den;
    var e = (s0.u * (s2.v * d1.x - s1.v * d2.x) + s0.v * (s1.u * d2.x - s2.u * d1.x) +
             (s2.u * s1.v - s1.u * s2.v) * d0.x) / den;
    var f = (s0.u * (s2.v * d1.y - s1.v * d2.y) + s0.v * (s1.u * d2.y - s2.u * d1.y) +
             (s2.u * s1.v - s1.u * s2.v) * d0.y) / den;
    // Expand the CLIP (not the mapping) about the centroid so neighbouring
    // triangles overlap by ~1px. Clipped edges antialias to a sub-pixel gap and
    // the mesh otherwise shows as a grid of seams right across the print.
    var gx = (d0.x + d1.x + d2.x) / 3, gy = (d0.y + d1.y + d2.y) / 3;
    function out(p) {
      var vx = p.x - gx, vy = p.y - gy;
      var m = Math.hypot(vx, vy) || 1;
      return [p.x + vx / m * 0.9, p.y + vy / m * 0.9];
    }
    var e0 = out(d0), e1 = out(d1), e2 = out(d2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(print, 0, 0, W, H);
    ctx.restore();
  }

  function draw() {
    if (!P.length) return;
    ctx.clearRect(0, 0, W, H);
    for (var r = 0; r < ROWS - 1; r++) for (var c = 0; c < COLS - 1; c++) {
      var A = P[idx(c, r)], B = P[idx(c + 1, r)], D = P[idx(c + 1, r + 1)], E = P[idx(c, r + 1)];
      var ua = { u: padX + c * sx, v: padY + r * sy };
      var ub = { u: padX + (c + 1) * sx, v: padY + r * sy };
      var ud = { u: padX + (c + 1) * sx, v: padY + (r + 1) * sy };
      var ue = { u: padX + c * sx, v: padY + (r + 1) * sy };
      tri(ua, ub, ud, A, B, D);
      tri(ua, ud, ue, A, D, E);

      // shading from how far the cell has sheared off its rest shape
      var w = Math.hypot(B.x - A.x, B.y - A.y) / sx;
      var sh = Math.max(-1, Math.min(1, (w - 1) * 2.2));
      if (sh !== 0) {
        ctx.fillStyle = sh > 0
          ? 'rgba(255,255,255,' + (sh * 0.14).toFixed(3) + ')'
          : 'rgba(0,0,0,' + (-sh * 0.24).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(D.x, D.y); ctx.lineTo(E.x, E.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(232,233,223,.75)';
    [P[idx(0, 0)], P[idx(COLS - 1, 0)]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.283); ctx.fill();
    });
  }

  function frame(t) {
    var dt = Math.min((t - last) / 1000 || 0.016, 1 / 30);
    last = t;
    if (!still.matches || held) { step(dt / 2); step(dt / 2); }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function at(e) {
    var b = cv.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  function pick(q) {
    var best = null, bd = GRAB * Math.min(W, H);
    for (var i = 0; i < P.length; i++) {
      if (P[i].pin) continue;
      var d = Math.hypot(P[i].x - q.x, P[i].y - q.y);
      if (d < bd) { bd = d; best = P[i]; }
    }
    return best;
  }

  cv.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var q = at(e), p = pick(q);
    if (!p) return;
    held = p; pointerId = e.pointerId; hx = p.x - q.x; hy = p.y - q.y;
    cv.setPointerCapture(e.pointerId);
    host.classList.add('is-held');
    e.preventDefault();   // only on the cloth, so the page still scrolls
  });

  cv.addEventListener('pointermove', function (e) {
    if (!held || e.pointerId !== pointerId) return;
    var q = at(e);
    held.x = q.x + hx; held.y = q.y + hy;
    held.px = held.x; held.py = held.y;
    e.preventDefault();
  });

  function release(e) {
    if (!held || (e && e.pointerId !== pointerId)) return;
    held.px = held.x; held.py = held.y;   // let go without flinging
    held = null; pointerId = null;
    host.classList.remove('is-held');
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('lostpointercapture', release);

  new IntersectionObserver(function (en) {
    onScreen = en[0].isIntersecting;
    if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!onScreen && raf) { cancelAnimationFrame(raf); raf = null; }
  }, { threshold: 0.12 }).observe(host);

  addEventListener('visibilitychange', function () {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
    else if (!document.hidden && onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  if (window.ResizeObserver) new ResizeObserver(build).observe(host);
  build();
  draw();
  // the motto is set in a webfont; repaint once it lands or it prints in serif
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { paint(); draw(); });
  }
})();
