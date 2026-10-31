# LumiLife — handoff

Last updated 2026-11-01. Sections 1–3 are built, reviewed and pushed to `main`.

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

Callout anchors are inline `--x` / `--y` percentages of the product box, with
`--lift` setting the leader length. They are routed into the empty margins
because the render itself has no readable space in the middle.

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

4. **Specs were deliberately left out.** Weight, battery life, hinge rating,
   price. Invented numbers were removed rather than guessed. Real figures will
   strengthen the anatomy section considerably — drop them in and they go
   straight into the callouts and the Product JSON-LD.

5. **Still to come for search and answer engines.** Organization, WebSite and
   Product (Glasses) JSON-LD are in. Still missing: the Ring as a second
   Product, and the FAQ block with FAQPage markup.

## Assets

Source material is in `C:\Users\User\Downloads\SQA`:

- `Home.pdf` — the wireframe and the reference screenshots
- `Olive Smart Glasses Exploded View.png` — assembled view is cropped from its top half
- `Exploded Smart Glasses Assembly.png` — the exploded render
- `Floating Olive Green Smart Ring.png` — already normalised into
  `assets/img/ring.png`, unused so far, ready for the Ring section

The ring has no exploded view yet.
