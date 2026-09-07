# MH Personal Coaching — website

Premium 1-op-1 coaching site for [mhpersonalcoaching.nl](https://www.mhpersonalcoaching.nl).
Static: three files, no build step required, no framework, no dependencies.

```
index.html            the page
assets/css/mh.css     design system + all section styles
assets/js/mh.js       real-time scenes + all interactions
server.mjs            local dev server (node, zero deps)
build.mjs             optional: inlines CSS/JS into one self-contained file
dist/                 output of build.mjs
DESIGN-SYSTEM.md      tokens, components, motion, interaction matrix
```

## Run it locally

```bash
node server.mjs
```

Then open <http://localhost:4321>. Any static host works too — drop the three
files on the server as-is.

## Fill in before launch

Everything unknown is a marked placeholder rather than invented content.

**1. Contact details** — done. `CONFIG` at the top of `assets/js/mh.js` has the
real WhatsApp number, phone, and email wired into every button on the site.

**2. Coach section** — done. `#coach` carries Joep Bruinsma's real name,
nickname ("The Technician"), disciplines, sterke punten, and bio, copied
verbatim from `content/team.json` in the `mhgym website` Next.js project
(the one already live on `/team/`). Nothing here is invented.

**3. Pricing (`#prijzen`)** — done. Sourced verbatim from `PT_PLANS` /
`PT_PACKAGES` in `ptController.js` in the `MHGym` app repo. See
`DESIGN-SYSTEM.md` for the exact provenance and what was deliberately left out
(the pre-tier flat plans, confirmed no longer sold).

**4. Official logo** — the site is ready for it, the file just isn't on disk
yet. Drop the two files described in `assets/img/logo/README.md` into that
folder — `mh-personal-coaching-logo-transparent.png` is picked up
automatically on next load (see `initBrandLogo()` in `mh.js`); no code change
needed. Until then the site quietly keeps its text wordmark.

**5. Coach portrait** — search the HTML for `class="frame"` in `#coach`. No
photo of Joep exists anywhere on this machine yet (not in this project, not in
the `mhgym website` project, not as a chat attachment I can save) — the
`.frame` placeholder is honest about that. Replace it with an `<img>` at the
same 4:5 ratio once a portrait is supplied.

**6. Remaining editable copy blocks** — search the HTML for `class="slot"`:

| Section | Needs |
| --- | --- |
| Resultaten | Real client stories, quotes, before/after photos, optional video |
| Persoonlijk contact | Actual reachability and response time |

Nothing here is invented — no fake reviews, no claimed certifications, no
"24/7 available" promise.

**7. Remaining photography** — the other `class="frame"` placeholders (hero
photography in "Het verschil", results section) work the same way as #5:
aspect-ratio box with corner marks and a caption naming the shot and ratio.
Replace the `<div class="frame ...">` with an `<img>` or `<picture>` at the
same ratio; the corner marks and gradient caption can stay as an overlay or be
dropped.

## Optional single-file build

```bash
node build.mjs
```

Produces `dist/mh-personal-coaching.html` with the CSS and JS inlined — useful
for previews, email attachments, or hosts that only accept one file. If the
logo files from step 4 above exist on disk at build time, they're embedded as
base64 data URIs too, so the single file stays genuinely standalone (the
hosted artifact preview, for instance, serves only this one file — no sibling
`assets/` folder). The build fails loudly if a CSS/JS include survives
inlining.

## Browser support

Chrome/Edge 117+, Safari 17.4+, Firefox 121+ — the animated `grid-template-rows`
used by the expanding goal panel is the newest feature in play. Older browsers
get the whole site minus that one transition.

Respects `prefers-reduced-motion`: both canvas scenes render a single still
frame, reveals show immediately, and the intro curtain is skipped.
