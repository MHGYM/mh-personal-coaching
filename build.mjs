/* Inlines the stylesheet and script into one self-contained page.
   Output: dist/mh-personal-coaching.html
   Usage:  node build.mjs                                                     */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname } from 'node:path';

const html = await readFile('index.html', 'utf8');
const css = await readFile('assets/css/mh.css', 'utf8');
let js = await readFile('assets/js/mh.js', 'utf8');

// The logo is loaded at runtime from a plain path (assets/img/logo/...), which
// only resolves when this build's companion assets/ folder ships alongside
// it. The dist/ build is meant to work as one standalone file — e.g. the
// hosted artifact serves *only* this HTML, no sibling folder — so if the
// logo file exists on disk at build time, embed it as a data: URI directly
// in the bundled script; the runtime <img>-swap code is unchanged either way.
// If the file doesn't exist yet, the plain path is left in place: the
// runtime probe 404s harmlessly and the site keeps its text wordmark exactly
// as designed (see initBrandLogo in assets/js/mh.js).
const LOGO_TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
for (const m of js.matchAll(/(['"])(assets\/img\/[^'"]+)\1/g)) {
  const [, quote, relPath] = m;
  try {
    const bytes = await readFile(relPath);
    const dataUri = `data:${LOGO_TYPES[extname(relPath).toLowerCase()] || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
    js = js.split(`${quote}${relPath}${quote}`).join(`${quote}${dataUri}${quote}`);
    console.log(`build: inlined ${relPath} (${(bytes.length / 1024).toFixed(1)} KB) as a data URI`);
  } catch {
    console.log(`build: ${relPath} not found on disk yet — left as a plain path (graceful no-op at runtime)`);
  }
}

const pick = (re, label) => {
  const m = html.match(re);
  if (!m) throw new Error(`build: could not find ${label} in index.html`);
  return m[0];
};

// index.html keeps the descriptive title it needs for search results; the
// single-file build is named for a gallery/tab, where the brand alone reads better.
pick(/<title>[\s\S]*?<\/title>/, '<title>');
const title = '<title>MH Personal Coaching</title>';
const fonts = pick(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, 'Google Fonts link');
const body = pick(/<body>([\s\S]*)<\/body>/, '<body>').replace(/^<body>|<\/body>$/g, '');

// Swap the external script for the inlined source; drop the external stylesheet.
// Replacer *functions* are used (not replacement strings) because mh.js
// contains literal "$$" (the querySelectorAll helper) — as a replacement
// *string* that sequence is a special pattern meaning "one literal $", which
// silently corrupted the inlined script on the first build.
const inlined = body
  .replace(/<script src="assets\/js\/mh\.js"><\/script>/, () => `<script>\n${js}\n</script>`)
  .replace(/<link rel="stylesheet" href="assets\/css\/mh\.css">/, () => '');

// assets/img/ may legitimately remain (see the logo-inlining step above —
// it's a documented, graceful degradation, not a leftover include). Only
// assets/css/ or assets/js/ here would mean an inline swap above failed.
if (/assets\/(css|js)\//.test(inlined)) {
  throw new Error('build: an assets/css or assets/js reference survived inlining — the output would not be self-contained');
}

const out = `${title}
${fonts}
<style>
${css}
</style>
${inlined}`;

await mkdir('dist', { recursive: true });
await writeFile('dist/mh-personal-coaching.html', out, 'utf8');
console.log(`dist/mh-personal-coaching.html — ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
