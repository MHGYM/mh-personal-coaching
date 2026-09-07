# MH Personal Coaching — design system

One dark visual world, committed to on purpose: the brand is a private studio
at night, not a gym in daylight. Every colour is painted explicitly, so the
page holds up on any host background.

---

## 1. Colour

All tokens live in `:root` in `assets/css/mh.css`.

| Token | Value | Role |
| --- | --- | --- |
| `--ink` | `#07070A` | Page ground. Near-black with a slight violet bias so it reads as night air, not printer black. |
| `--obsidian` | `#101016` | Raised surface |
| `--graphite` | `#1B1B22` | Card top stop |
| `--steel` | `#2A2A33` | Hardware, chain shadow |
| `--gold` | `#C9A24B` | Accent. Forged brass. |
| `--gold-lift` | `#E4C87E` | Gold gradient top stop |
| `--gold-spec` | `#F0DCA8` | Specular highlight, accent text on dark |
| `--gold-deep` | `#8A6C27` | Gold gradient bottom stop |
| `--warm` | `#F2EEE6` | Primary text |
| `--warm-dim` | `#CFCAC0` | Body text |
| `--muted` | `#8B8994` | Secondary text. Grey carries the same violet bias as the ground. |
| `--muted-deep` | `#5B5A64` | Tertiary, disabled |
| `--line` / `--line-strong` / `--line-gold` | warm-white at 9% / 16%, gold at 34% | Hairlines |

**Rule for gold.** Gold is *light and engraving*, never a field. It appears as
hairlines, small uppercase labels, rim light, price figures, list markers, and
exactly one filled surface: the primary button. If a section has more than one
gold moment competing for attention, the weaker one becomes `--muted`.

---

## 2. Typography

Three faces, three jobs. The pairing — a high-contrast didone against a heavy
grotesque — is the signature; it is what makes the page read as fashion-premium
rather than sports-premium.

| Role | Face | Usage |
| --- | --- | --- |
| Display | **Archivo** variable, `wdth 88 / wght 800`, uppercase, `-0.018em` | All headlines. Athletic grotesque — deliberately not Bebas/Oswald gym-cliché. |
| Editorial | **Bodoni Moda** | Price figures, timeline step numbers, pull-quotes, the intake counter. Italic for quotes. |
| Body / UI | **Instrument Sans** 400/500/600 | Running copy, buttons, labels |

### Scale

| Class | Size | Use |
| --- | --- | --- |
| `.d-hero` | `clamp(2.6rem, 7.6vw, 9rem)` | Hero + final CTA |
| `.d-1` | `clamp(2.3rem, 6.4vw, 6.25rem)` | Section headlines |
| `.d-2` | `clamp(1.85rem, 4.2vw, 3.75rem)` | Sub-headlines, intake result |
| `.d-3` | `clamp(1.25rem, 1.9vw, 1.75rem)` | Card titles |
| `.lead` | `clamp(1.05rem, 1.35vw, 1.375rem)` | Intro paragraphs, max 46ch |
| `.copy` | `clamp(0.975rem, 1.02vw, 1.0625rem)` | Body, max 58ch |
| `.label` | `0.6875rem`, `0.22em` tracking, uppercase | Eyebrows, captions, meta |

Every `.d-*` class carries the full display treatment (family, weight, case,
tracking, line-height) — not just a size. A size-only class silently falls back
to the body face, which is exactly the bug that produced lowercase Instrument
Sans in the first build of section 2.

Dutch compounds get long: `.d-3` and `.plan__freq` enable `hyphens: auto`, and
all display classes set `overflow-wrap: break-word` as a safety net.

### Structural devices

`.eyebrow` — a gold hairline followed by an uppercase label. This is the
recurring section signature. Its children must be a single flex item, or the
rule and the text wrap apart.

Numbering is used **only where order is real information**: the seven timeline
steps and the intake's `01 / 05` counter. The six goal cards carry a discipline
kicker (`VETVERLIES`, `TECHNIEK`, `OPBOUW`, `PRESTATIE`, `HERSTART`) instead of
an index, because those six have no order.

---

## 3. Space, borders, elevation

- **Space scale** `--s-1`…`--s-11`: 4px base, doubling (0.25 / 0.5 / 0.75 / 1 /
  1.5 / 2 / 3 / 4 / 6 / 8 / 12 rem). Use tokens, never raw values.
- **Section rhythm** `--pad-section: clamp(5rem, 11vh, 10.5rem)` vertical.
- **Containers** `.shell` = `min(100% - 2.5rem, 84rem)`, `.shell-wide` = 100rem.
- **Radii** 2–6px only. Equipment is machined, not rounded. No pill cards.
- **Elevation** `--sh-1` resting card, `--sh-2` raised/hover, `--sh-gold` for
  the primary button's hover glow. Shadows are deep and tight (large negative
  spread), the way a single overhead light behaves.
- Layout spacing is always flex/grid `gap`, never per-element margins.

---

## 4. Components

**Buttons** `.btn` + `.btn--gold` (primary, brass gradient) · `.btn--ghost`
(gold hairline) · `.btn--quiet` (underline only) · `.btn--sm` · `.btn--full`.
Every button has a metallic sheen sweep on hover (`::after`, 900ms). Minimum
height 3.25rem — thumb-friendly at every breakpoint. `white-space: nowrap`.

**Cards** `.card`. Gradient surface, hairline border, and two cursor
behaviours: a gold radial light that follows the pointer inside the card
(`--mx`/`--my`, set by one delegated listener), and a gold hairline that draws
across the top edge. Hover lifts 3px.

**Frames** `.frame` — photo/video placeholders with machined corner marks and a
caption naming the shot and ratio. Variants: `--portrait` 4:5, `--wide` 16:10,
`--tall` 3:4.

**Slots** `.slot` — dashed gold box with a `.slot__tag` label. Marks content
that is deliberately unwritten (coach bio, testimonials, terms). Honest by
design: it is visible that something belongs there.

**Chips** `.chip` / `.chip--gold` — equipment legend, contact placeholders.

---

## 5. Motion system

Tokens: `--e-out` `cubic-bezier(.16,.84,.24,1)` (settling), `--e-inout`
`cubic-bezier(.62,.02,.20,1)` (statement lines). Durations `--t-fast` 200ms,
`--t-mid` 420ms, `--t-slow` 780ms, `--t-cine` 1200ms.

Nothing bounces, spins, or overshoots. Motion reads as **weight under
control** — strength, precision, restraint.

| Pattern | Implementation |
| --- | --- |
| Cinematic entrance | `[data-reveal]` + IntersectionObserver, 1200ms, `data-d` staggers in ms |
| Statement lines | `.stmt > span` translate 105% → 0 behind `overflow: hidden` |
| Card expansion | `grid-template-rows: 0fr → 1fr`, 780ms |
| Depth / parallax | pointer position lerped in one rAF loop, layers at 8 / 20 / 30px |
| Physics | verlet chain + distance constraints (hero), damped pendulums (studio) |
| Intro curtain | one 1250ms hairline sweep, then removed from the DOM |

**One rAF loop** (`Ticker`) drives everything scroll- or pointer-reactive.
Subscribers receive `(scrollY, dt)`; `scrollY` is read once per frame, so no
subscriber triggers layout thrash. The loop stops on `visibilitychange`, and
both canvas scenes unsubscribe from painting when off-screen.

---

## 6. Real-time scenes (no video, no GIFs)

### Hero — hanging heavy bag

A five-link chain plus a rigid bag, integrated with **verlet + weighted
distance constraints** (6 iterations desktop, 4 on touch). The bag's foot point
carries the mass (`invMass 0.12`), which is what makes the secondary motion in
the chain look right.

Forces: gravity · air drag · a two-sine ambient draught so the rhythm never
loops audibly · pointer sweep (air pushed ahead of the cursor, falling off over
1.5 bag-lengths, plus a term from cursor velocity) · scroll impulse from frame
delta · punch impulse on click, with chain rattle, a light flash, and a dust
burst.

Painted per frame: cached wall/floor backdrop → volumetric light shaft and
floor pool → far dust → chain (alternating link orientation, metallic gradient,
one warm glint each) → contact shadow → bag (cylinder shading whose highlight
tracks the light, sheen streak, stitched seams, steel top cap) → gold engraving
bowed per-character to follow the cylinder and auto-fitted to the leather →
near dust.

The bag's position, size and the light's position all derive from one
breakpoint tier in `layout()` — desktop ≥1000px (0.74W, full size), tablet
≥640px (0.80W, smaller), phone (0.58W, small and high, copy bottom-aligned).
Splitting that logic between `layout()` and `draw()` is what once left the
light shaft pointing at empty wall.

### Studio — back-lit equipment

Near-black silhouettes with a brass rim against a warm glow: plate rack, bench
with gloves, coiled rope, two kettlebells, a dumbbell, and two hanging bags on
independent damped pendulums with a slow driving breath so they never fully
still. Objects sit on a floor line at `0.48H` — above the copy band, never
behind it — and scale with viewport width. Layers answer the pointer at
0.45× / 1.0× / 1.3×.

Both scenes: DPR capped at 2, `ResizeObserver`-driven relayout, particle counts
halved on touch, and a single still frame under `prefers-reduced-motion`.

---

## 7. Interaction matrix

What is static, what is live, and what responds to what — for implementation
planning.

| Element | Static | Real-time | Scroll | Hover | Click / tap |
| --- | --- | --- | --- | --- | --- |
| Hero bag + chain | — | physics loop | drifts out of frame, fades | cursor sweep pushes bag, light shifts | punch impulse + dust |
| Hero dust | — | drift + wrap | — | parallax by depth | burst on punch |
| Hero type | layout | — | lifts 90px, fades | — | — |
| Nav | layout | — | sticks, hides down / shows up, marks section | link underline draws | burger → full-screen menu |
| Statement lines | — | — | reveal per line | — | — |
| Goal cards | grid | — | reveal | gold name, top hairline, cursor light | expands full-width row, siblings recede |
| Deliverable cards | grid + icons | — | reveal | icon lifts, cursor light | — |
| Timeline | rail + steps | — | gold fill tracks progress, steps light | — | — |
| Studio scene | — | pendulums + dust | layer parallax | layer parallax | — |
| Pricing | layout | — | reveal | card lift, sheen on CTA | — |
| Comparison | layout | — | reveal from both sides | — | — |
| Intake | layout | — | — | option hover | select → auto-advance; result → WhatsApp |
| Pointer light | — | lerped follow | — | follows cursor | — |
| Thumb bar (<1240px) | — | — | rises past the hero | — | — |

### Touch equivalents

Pointer-only behaviours are re-built rather than dropped: dragging across the
hero swings the bag directly, cards use their pressed state instead of cursor
light, and the goal panel opens directly beneath the tapped card in the
single-column grid. `(hover: none)` also halves particle counts and drops
constraint iterations.

---

## 8. Breakpoints

| Width | Layout |
| --- | --- |
| < 620px | Everything single column. Bag small and high, copy bottom-aligned in the hero, hero scroll cue hidden, pillars a 3-column grid, thumb bar active. |
| 620–879px | Deliverables 2-col, goals 2-col (≥700px), plans stacked. |
| 880–1099px | Plans 3-col, comparison stacked. |
| 1100–1239px | Deliverables 4-col, goals 3-col (≥1080px). Burger nav — seven links plus brand plus CTA do not fit yet. |
| ≥ 1240px | Full nav with links and CTA, thumb bar hidden. |
| ≥ 960px | Comparison splits 0.72fr / 1.28fr — the MH panel is deliberately wider, brighter and gold-edged. |

No horizontal scrolling at any width; wide content scrolls inside its own
container.

---

## 9. Accessibility

- Every interactive element is a real `<button>` or `<a>` with a visible
  `:focus-visible` gold ring.
- Goal cards expose `aria-expanded` / `aria-controls`; the panel toggles
  `aria-hidden`.
- Intake options are `role="radio"` in labelled `role="radiogroup"`s; the step
  counter is `aria-live="polite"`.
- The burger reports `aria-expanded`; Escape closes the menu; opening it locks
  the page scroll.
- Skip link to `#main`. All decorative canvases are `aria-hidden`.
- `prefers-reduced-motion` is honoured everywhere, including both canvas scenes.
