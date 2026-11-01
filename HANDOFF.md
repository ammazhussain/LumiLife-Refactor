# LumiLife — handoff

Last updated 2026-11-01. Sections 1–8 are built, plus the cart drawer and a
reveal footer. Several blocks ship as deliberate placeholders — see below.

## Run it

```bash
python -m http.server 8777
# then open http://127.0.0.1:8777/
```

Serve it over http. Opening `index.html` as a `file://` URL **silently kills the
fonts** — Chrome blocks woff2 across the `null` origin and you get the fallback
faces with no error that points at the cause.

Design target is an L desktop screen, 1440–1600 wide. Below 1100px the scroll
stage unsticks and everything stacks; that path is a safety net, not a designed
mobile layout yet.

## What is in the repo

```
index.html          the whole page — all copy lives here, plus the JSON-LD
css/site.css        one stylesheet, sections in source order
js/site.js          two small IIFEs: the scroll stage, and the nav auto-hide
assets/img/         product renders, pre-processed (see below)
assets/fonts/       Clash Display + Satoshi, variable woff2, self-hosted
```

## Sections so far

**1 — Hero.** `Ambient / AI for / Real Life` is the real `<h1>`, set in Clash
Display and split top-left / bottom-right. The glasses float in front of the
type. Trust facts top-right, lead copy and the primary CTA bottom-left.

**2 — Anatomy.** Same sticky stage. The assembled render crossfades into the
exploded assembly while the exploded one scales `1.085 → 1`, so the olive frame
front holds position and only the parts fly apart. Five callouts with hairline
leaders arrive mid-separation.

**4 — The collection.** Two product cards, Glasses and Ring, at `#buy`. Every
claim is recycled from sections 1–3; nothing new is asserted. The eight spec
Each card shows one spec row: **Price**. Glasses EUR 320, Ring EUR 179 — real
figures, also carried as `offers` in the Product JSON-LD. Battery / weight / box
contents were cut on request; there is no primary button, the cart icon beside
the price is the only CTA.

The cart is **in-memory only** (`js/site.js`, last IIFE). The icon carries
`data-add-to-cart="<name>"`; the handler bumps a counter, writes `data-count` on
`.nav__cart` (the badge renders it via `content:attr(...)`), updates the
`aria-label`, and flies a clone of the card render into the cart with
`element.animate()` — no library. The clone keeps `mix-blend-mode:multiply` so
it still drops its white backdrop in flight. The count is incremented on click,
not on landing, so an interrupted flight cannot lose it. Nothing persists and
there is no backend — `#cart` is still a dead anchor. `.card__media` paints its own background for the
same `multiply` reason `.stage__sticky` does.

**5 — Before / After.** `#shift`. Two cards: "before" on flat paper, "after" on
olive — the contrast is carried by the surfaces, not by adjectives in the copy.
The two images are **placeholders** cut from `lifestyle-slide-6.webp` and still
carry that comp's baked-in captions and logo. All the section's own words are
real HTML, so swapping in clean photography changes nothing else.

The About section was built and then removed on request; its nav slot now points
at `#shift`.

**3 — The canvas.** Deep Olive, full screen, chrome removed exactly as the
wireframe asked: no nav, no cart, no product toggle. States the idea behind the
motto, with six everyday asks beside it, and the three trust facts on a rule
along the bottom.

## Two things to know before you touch it

**The renders have no alpha channel, and do not need one.** Each PNG in
`assets/img/` was divided by its own background colour so the studio backdrop is
exactly white, then it is composited with `mix-blend-mode: multiply`. White
multiplies to the page colour, the contact shadows survive, and the display type
reads through from behind. If you swap in a new render, run it through the same
normalisation first or it will sit on a visible grey rectangle.

The gotcha: **multiply needs a painted backdrop in the same stacking context.**
The background on `<body>` is not enough, because the images sit inside a
`position: sticky` wrapper. `.stage__sticky` carries its own copy of the page
gradient for exactly this reason — delete that line and the renders turn into
white boxes.

**The morph alignment is three knobs, not magic.** `--parts-scale`,
`--parts-x`, `--parts-y` at the top of `site.css` align the exploded frame onto
the assembled one. The two renders happen to share a camera angle, so the frame
lands within about 2%. Nudge those values if you change the image sizes.

Scroll phases live in `js/site.js` as three ranges over one `p` value: parts
`0.12–0.58`, hero copy out `0.08–0.34`, anatomy copy in `0.26–0.50`. They
overlap on purpose — pull them apart and a dead beat opens up in the middle
where the screen is just a product on empty paper.

Callout anchors are inline `--xf` / `--yf` — the dot's position on the render as
a bare fraction — plus `--ty`, the label's own slot in the gutter. Decoupling
those two is the whole mechanism: labels get an even rhythm down the side and
the leader elbows out to meet the part, so no label has to sit where its part
happens to be. **`--ty` must stay <= `--yf`** (label at or above its part) or the
elbow inverts; there is no flipped variant.

The leader is ONE bordered box, not two hairlines meeting at a corner. Its
border-top is the horizontal run and its border-left/right the drop, so the
corner is a real rounded join. Two separate elements drift apart by exactly the
dot's radius at every corner — that bug shipped once already.

## Verify your own work — there is a headless browser

```bash
node ~/.claude/skills/browser-automation/browser.mjs http://localhost:8777/   --eval "..."  --script ./probe.mjs  --screenshot out.png
```

Use it. Several defects in this page were invisible to reasoning and obvious in
one measurement:

- the Ring card render at **692px tall inside a 240px box** (`display:grid` gives
  the media an auto-sized implicit row, so `max-height:100%` resolves against the
  image's own height — circular, no constraint. flex has a definite height, so
  the percentage resolves)
- the seal's `grid-row:1/-1` with an auto column inventing a second grid column
  and throwing the whole section sideways
- `.canvas__h` stranding a one-word last line at 1850 but not at 1600

Measure line breaks with Range rects per character, not `height / line-height` —
padding makes the arithmetic lie.

## `height` vs `min-height` — this bit twice

Section 4 must fit one viewport, so `.collection` is `height:100vh`, NOT
`min-height`. A percentage (`max-height:100%`) resolves only against a
**definite** height, and `fr` only distributes real free space. With
`min-height` the whole chain stays indefinite, the card media falls back to the
image's natural size, and the 1135x1100 ring render drags both cards to 1440px.

The chain has to stay definite the whole way down:
`.collection{height:100vh}` -> `grid-template-rows:auto minmax(0,1fr)` ->
`.cards{min-height:0}` -> `.card{grid-template-rows:minmax(120px,1fr) auto}` ->
`.card__media{min-height:0}`. Break any link and the ring balloons again.
`min-height:660px` on the section is the floor below which we stop trying.

The `120px` floor on the media track is load-bearing too: with `minmax(0,1fr)`
the body ate everything and the render measured 0x0 at a 720px viewport.

## Two typographic traps in this file

**`ch` resolves against the element's OWN font-size — put the measure on the
heading, never on its wrapper.** `max-width:26ch` on a 16px `<div>` wrapping a
56px `<h2>` is ~300px, not ~1000px, and the heading shatters into four lines.
This has bitten twice now.

**`max-width` in `ch` scales with `font-size`.** Shrinking the type to fix a bad
wrap changes nothing, because the measure shrinks by the same factor and the
line breaks land identically. Move both or neither.

**`text-wrap: balance` does not cross a `<br>`.** It was tried on `.canvas__h`
and measured to change nothing at 1440/1600/1850. The last two words of each
sentence are bound with `&nbsp;` instead, which is what actually holds.

## The support cloth (`#support`)

A pinned sheet you can grab and tug: Verlet points on a 2D canvas, no WebGL.
The green/sage print is an **offscreen canvas texture-mapped per triangle** with
an affine transform, so the type creases with the cloth. ~240 triangles, 61fps.

Three things are load-bearing and were each found by looking, not reasoning:
- The triangle **clip** is expanded ~1px about its centroid. Clipped edges
  antialias to a sub-pixel gap and the mesh otherwise shows as a grid of seams.
- **Shear diagonals, 2-apart bend links and pin tethers** (104% of rest
  distance). With structural links alone one hard yank folds the grid flat and
  it never recovers.
- `document.fonts.ready` repaints the print. Without it the motto prints in the
  serif fallback, because canvas text does not re-render when a webfont lands.

Painted text is invisible to find-in-page, selection and screen readers, so the
canvas carries `role="img"` plus a visually-hidden `.sheet__alt` copy. Keep both
in step if the motto changes.

## The reveal footer

`main` is opaque (`background: var(--paper)`) and `z-index: 1`; the footer is
`position: fixed; bottom: 0; z-index: 0` inside `.revealwrap`, which carries
`clip-path: inset(0)`. That clip-path is the whole trick: it makes the wrapper a
containing block for the fixed footer, so the effect is scoped to the end of the
page with **no scroll listener at all**.

The one thing CSS cannot do is measure the footer, and the wrapper must be
exactly as tall as it or the page over- or under-scrolls. `js/site.js` sets it,
and re-sets on resize, on `ResizeObserver`, and after `document.fonts.ready` —
webfonts landing late is what silently breaks this.

If `main` ever loses its background, there is nothing to reveal and the footer
just shows through the page.

## The product toggle is scoped by JS

`.nav__group--center` only belongs to the two stage panels it controls. An
IntersectionObserver over `main > section` puts `.past-stages` on `<body>`, and
the toggle goes `visibility:hidden` — out of tab order, not merely faded. **Any
new section added to `<main>` is covered automatically** by that selector; it
was `.canvas, .collection` first and the About section immediately escaped it.

The class lives on `<body>` because the header is a *preceding* sibling of every
section, and CSS cannot select backwards.

## Open decisions for next session

1. **In-use imagery.** The wireframe wants photos and video of the product being
   worn. None exist — only the three studio renders. Section 3 was built to
   stand on its own without them. Options: generate lifestyle shots with
   Higgsfield (spends credits, needs the go-ahead), or keep it typographic and
   drop real photos in later.

2. **Section 4.** Either the product cards from the wireframe's "Prod Picture"
   row (Glasses and Ring side by side), or the before/after conversion block
   sketched after it. Not decided.

3. **Copy that is still mine, not verified.** Two lines describe the hardware
   from what the exploded render shows, and should be confirmed or reworded:
   *"Speaker — aimed at your ear, not at the room"* and *"Lumi processor — runs
   on the glasses, not in a data centre."*

4. **Prices are now real** (Glasses EUR 320, Ring EUR 179) and are in the
   Product JSON-LD as `offers`. Weight, battery life and hinge rating are still
   unknown and were cut from the cards rather than guessed. If real figures
   arrive they belong in the anatomy callouts.

5. **Still to come for search and answer engines.** Organization, WebSite and
   both Products (with `offers`) are in. Still missing: the FAQ block with
   FAQPage markup.

6. **Placeholders that must not ship as-is:**
   - all 8 marquee slides (`#lifestyle`) — flat olive, awaiting real comps
   - all 3 beta-tester quotes (`#testers`) — **no real tester has been quoted**
   - the phone number, masked as `+49 30 ****` on the cloth and in the footer:
     a plausible-looking number is somebody's real number
   - the footer's App Store / Google Play buttons. These are **trademarked
     artwork** with mandated clear space and sizing — fetch the official badges
     from Apple's and Google's marketing resources, do not redraw them. They
     currently render as non-interactive "Coming soon" pills, which is also
     true: there is no app to download.
   - the footer's legal links
   - **no social links exist** — the handles were never supplied
   `SQA/glasses-product.mp4` (9.9 MB) and `ring-product.mp4` (12 MB) are still
   unused — too heavy to autoplay as-is, they need poster frames and
   compression first.

7. **Support copy is topics only, never policy.** Warranty terms, return windows
   and repair pricing are not known. Do not write them from memory.

8. **Checkout is inert.** The cart drawer works end to end but the Checkout
   button does nothing — no payment backend. Decide: Stripe Checkout, a
   Kickstarter link like the live site uses, or email capture.

## Assets

Source material is in `C:\Users\User\Downloads\SQA`:

- `Home.pdf` — the wireframe and the reference screenshots
- `Olive Smart Glasses Exploded View.png` — assembled view is cropped from its top half
- `Exploded Smart Glasses Assembly.png` — the exploded render
- `Floating Olive Green Smart Ring.png` — already normalised into
  `assets/img/ring.png`, unused so far, ready for the Ring section

The ring has no exploded view yet.
