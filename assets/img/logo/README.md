Drop the two official logo files here, named exactly:

- `mh-personal-coaching-logo-transparent.png` — used site-wide (header, footer).
  Picked up automatically on next page load, no code change needed.
- `mh-personal-coaching-logo-black.png` — reserved for a possible large-format
  hero placement (not currently wired up — the hero already carries the brand
  through the engraving on the physical bag; adding a second static logo
  there would compete with it. Ask if you want it added anyway).

Until the transparent file exists, the site quietly keeps the current text
wordmark — see `initBrandLogo()` in `assets/js/mh.js`.
