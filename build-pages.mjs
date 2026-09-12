/* Generates the multi-page site from pages-src/*-body.html + the shared
   head/nav/footer templates below. Run with `node build-pages.mjs` whenever
   a page body or the shared chrome changes, then commit the generated
   .html files alongside the source — same "generate, then commit the
   output" pattern as build.mjs/dist/. No build step runs in CI; GitHub
   Pages just serves whatever .html files are committed. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://mhpersonalcoaching.nl';

const NAV_ITEMS = [
  { id: 'home',     label: 'Home',            href: 'index.html' },
  { id: 'coaching', label: 'Coaching',         href: 'coaching.html' },
  { id: 'doelen',   label: 'Doelen',           href: 'doelen.html' },
  { id: 'aanpak',   label: 'Aanpak',           href: 'aanpak.html' },
  { id: 'prijzen',  label: 'Prijzen',          href: 'prijzen.html' },
  { id: 'coach',    label: 'Over de coach',    href: 'coach.html' },
  { id: 'contact',  label: 'Contact',          href: '#contact' }
];

const LOCAL_BUSINESS_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'ExerciseGym',
  name: 'MH Personal Coaching',
  image: SITE + '/assets/img/logo/mh-personal-coaching-logo-transparent.png',
  url: SITE,
  telephone: '+31640893537',
  email: 'mhmultidiensten@hotmail.com',
  priceRange: '€€',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Belvedereweg 3B',
    postalCode: '3762 EE',
    addressLocality: 'Soest',
    addressRegion: 'Utrecht',
    addressCountry: 'NL'
  },
  areaServed: [
    { '@type': 'City', name: 'Soest' },
    { '@type': 'City', name: 'Baarn' },
    { '@type': 'City', name: 'Soesterberg' },
    { '@type': 'City', name: 'Amersfoort' },
    { '@type': 'City', name: 'Hilversum' }
  ],
  parentOrganization: { '@type': 'Organization', name: 'MH Gym' }
};

function renderHead(page) {
  const canonical = SITE + '/' + (page.file === 'index.html' ? '' : page.file);
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<meta name="theme-color" content="#07070A">
<meta property="og:title" content="${page.ogTitle || page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/assets/img/logo/mh-personal-coaching-logo-transparent.png">
<meta property="og:locale" content="nl_NL">
<link rel="canonical" href="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..600;1,6..96,400..500&family=Instrument+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/css/mh.css">
<script type="application/ld+json">${JSON.stringify(LOCAL_BUSINESS_JSONLD)}</script>`;
}

function renderHeader(page) {
  const curtain = page.curtain ? `<!-- Intro curtain: one short entrance, then it removes itself -->
<div class="curtain" aria-hidden="true">
  <div class="curtain__mark">
    <span>MH Personal Coaching</span>
    <i></i>
  </div>
</div>

` : '';

  const navLinks = NAV_ITEMS.map(function (item) {
    var cls = 'nav__link' + (item.id === page.active ? ' is-current' : '');
    return `    <a class="${cls}" href="${item.href}">${item.label}</a>`;
  }).join('\n');

  const menuLinks = NAV_ITEMS.map(function (item, i) {
    var cls = 'menu__link' + (item.id === page.active ? ' is-current' : '');
    return `  <a class="${cls}" href="${item.href}" data-d="${40 + i * 40}">${item.label}</a>`;
  }).join('\n');

  return `${curtain}<div class="pointer-light" aria-hidden="true"></div>

<a class="skip btn btn--sm btn--ghost" href="#main">Naar hoofdinhoud</a>

<!-- ══════════════════════════════════════════════════════ NAVIGATION ══ -->
<header class="nav">
  <a class="brand" href="index.html" aria-label="MH Personal Coaching, naar de homepage">
    <span class="brand__mark" aria-hidden="true">MH</span>
    <img class="brand__logo" alt="MH Personal Coaching" hidden>
    <span class="brand__text">
      <span class="brand__name">Personal Coaching</span>
      <span class="brand__sub">Powered by MH Gym</span>
    </span>
  </a>

  <nav class="nav__links" aria-label="Hoofdnavigatie">
${navLinks}
  </nav>

  <a class="btn btn--gold btn--sm nav__cta" href="intake.html">Plan een kennismaking</a>

  <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Menu">
    <span></span><span></span>
  </button>
</header>

<div class="menu" id="menu">
${menuLinks}
  <div class="menu__foot">
    <a class="btn btn--gold" href="intake.html">Plan een kennismaking</a>
    <p class="label">Powered by MH Gym · <a data-mhgym href="#">Bekijk MH Gym</a></p>
  </div>
</div>

<main id="main">
`;
}

function renderFinale() {
  return `<!-- ═══════════════════════════════════════════════════ FINAL CTA ══ -->
<section class="finale">
  <div class="finale__glow" aria-hidden="true"></div>
  <div class="shell finale__inner">
    <p class="label label--gold eyebrow" data-reveal>De laatste stap</p>
    <h2 class="d-hero" data-reveal data-d="80">Klaar om te beginnen?</h2>
    <p class="lead" data-reveal data-d="160" style="text-align:center">
      Jouw doel verdient meer dan een standaard sportschool.
    </p>
    <div class="finale__actions" data-reveal data-d="240">
      <a class="btn btn--gold" href="intake.html">Start jouw transformatie</a>
      <a class="btn btn--ghost" href="#contact" data-wa="Hoi, ik wil graag meer weten over MH Personal Coaching.">
        <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5z"/><path d="M8.8 9.2c.3 2.4 3.6 5.7 6 6l1-1.6 2 .9-.6 1.7c-2.9.5-7.9-4.4-7.4-7.4l1.7-.6.9 2z" fill="currentColor" stroke="none"/></svg>
        WhatsApp
      </a>
    </div>
    <div class="row" style="justify-content:center;margin-top:1rem" data-reveal data-d="300">
      <span class="chip chip--gold" data-phone>Telefoonnummer — in te vullen</span>
      <span class="chip" data-mail>E-mailadres — in te vullen</span>
      <span class="chip" data-address>Adres — in te vullen</span>
    </div>
  </div>
</section>

`;
}

function renderFooter(page) {
  return `</main>

<!-- ══════════════════════════════════════════════════════ FOOTER ══ -->
<footer class="foot" id="contact">
  <div class="shell">
    <div class="foot__grid">
      <div class="foot__col">
        <a class="brand" href="index.html">
          <span class="brand__mark" aria-hidden="true">MH</span>
          <img class="brand__logo" alt="MH Personal Coaching" hidden>
          <span class="brand__text">
            <span class="brand__name">Personal Coaching</span>
            <span class="brand__sub">Powered by MH Gym</span>
          </span>
        </a>
        <p class="dim" style="max-width:34ch;font-size:.875rem">
          Privé 1-op-1 personal coaching in Soest. Eén trainer, één cliënt,
          volledige aandacht — van startmeting tot resultaat.
        </p>
      </div>

      <nav class="foot__col" aria-label="Footernavigatie">
        <p class="label">Navigatie</p>
        <a class="foot__link" href="coaching.html">Coaching</a>
        <a class="foot__link" href="doelen.html">Doelen</a>
        <a class="foot__link" href="aanpak.html">Aanpak</a>
        <a class="foot__link" href="small-group.html">Small group</a>
        <a class="foot__link" href="prijzen.html">Prijzen</a>
        <a class="foot__link" href="coach.html">Over de coach</a>
        <a class="foot__link" href="resultaten.html">Resultaten</a>
      </nav>

      <div class="foot__col">
        <p class="label">Contact</p>
        <a class="foot__link" href="#contact" data-wa>WhatsApp</a>
        <a class="foot__link" href="#contact" data-mail>E-mail — in te vullen</a>
        <a class="foot__link" href="#contact" data-phone>Telefoon — in te vullen</a>
        <a class="foot__link" href="#contact" data-address>Belvedereweg 3B, Soest</a>
        <a class="foot__link" href="intake.html">Plan een kennismaking</a>
      </div>
    </div>

    <div class="foot__bar">
      <p class="label">© <span id="year">2026</span> MH Personal Coaching · mhpersonalcoaching.nl</p>
      <div class="foot__mh">
        <span class="label">Powered by MH Gym</span>
        <a data-mhgym href="#">Bekijk MH Gym</a>
      </div>
    </div>
  </div>
</footer>

<!-- Mobile-only thumb bar: appears once the hero is behind you -->
<div class="thumb-bar">
  <a class="btn btn--gold" href="intake.html">Kennismaking</a>
  <a class="btn btn--ghost" href="#contact" data-wa>WhatsApp</a>
</div>

<script src="assets/js/mh.js"></script>
<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</body>
</html>
`;
}

const PAGES = [
  {
    file: 'index.html', active: 'home', curtain: true, finale: true,
    title: 'MH Personal Coaching Soest | 1-op-1 Personal Training',
    description: 'Privé personal training in Soest en omgeving. Eén trainer, één cliënt, volledige aandacht — training, voeding, meting en herstel in één traject op maat.',
    body: 'home-body.html'
  },
  {
    file: 'coaching.html', active: 'coaching', curtain: false, finale: true,
    title: 'Personal Coaching Soest — Wat je krijgt | MH Personal Coaching',
    description: '1-op-1 training, voedingsadvies, maandelijkse meting, recovery en persoonlijke begeleiding. Bekijk wat personal coaching bij MH Personal Coaching in Soest inhoudt.',
    body: 'coaching-body.html'
  },
  {
    file: 'doelen.html', active: 'doelen', curtain: false, finale: true,
    title: 'Afvallen, Kickboksen & Krachttraining Soest | MH Personal Coaching',
    description: 'Kies je doel: afvallen, kickboksen leren, boksen, spiergroei, kracht & conditie of fitter worden. Persoonlijke coaching in Soest voor elk doel.',
    body: 'doelen-body.html'
  },
  {
    file: 'aanpak.html', active: 'aanpak', curtain: false, finale: true,
    title: 'Onze Aanpak | Personal Coach Soest — MH Personal Coaching',
    description: 'Van gratis kennismaking tot meetbaar resultaat in zeven stappen. Zo werkt personal coaching bij MH Personal Coaching in Soest.',
    body: 'aanpak-body.html'
  },
  {
    file: 'small-group.html', active: null, curtain: false, finale: true,
    title: 'Small Group Training Soest | MH Personal Coaching',
    description: 'Trainen in een vaste kleine groep van 2 tot 4 personen, met dezelfde persoonlijke aandacht als 1-op-1 coaching. Beschikbaar bij MH Personal Coaching in Soest.',
    body: 'small-group-body.html'
  },
  {
    file: 'prijzen.html', active: 'prijzen', curtain: false, finale: false,
    title: 'Tarieven Personal Training Soest | MH Personal Coaching',
    description: 'Geen vaste pakketprijzen — elk traject wordt op maat samengesteld tijdens een gratis kennismaking. Ontdek de mogelijkheden bij MH Personal Coaching in Soest.',
    body: 'prijzen-body.html'
  },
  {
    file: 'coach.html', active: 'coach', curtain: false, finale: true,
    title: 'Ontmoet je Personal Coach in Soest | MH Personal Coaching',
    description: 'Maak kennis met de coaches van MH Personal Coaching in Soest — hun aanpak, disciplines en sterke punten.',
    body: 'coach-body.html'
  },
  {
    file: 'resultaten.html', active: null, curtain: false, finale: true,
    title: 'Resultaten | MH Personal Coaching Soest',
    description: 'Trajecten van cliënten van MH Personal Coaching in Soest, in cijfers en in hun eigen woorden.',
    body: 'resultaten-body.html'
  },
  {
    file: 'intake.html', active: 'contact', curtain: false, finale: false,
    title: 'Gratis Kennismaking | MH Personal Coaching Soest',
    description: 'Vijf korte vragen en je weet direct of personal coaching bij MH Personal Coaching in Soest bij jou past. Plan een gratis, vrijblijvende kennismaking.',
    body: 'intake-body.html'
  }
];

for (const page of PAGES) {
  const bodyPath = join(__dirname, 'pages-src', page.body);
  const bodyHtml = readFileSync(bodyPath, 'utf8');
  const html = `<!doctype html>
<html lang="nl">
<head>
${renderHead(page)}
</head>
<body>

${renderHeader(page)}
${bodyHtml}
${page.finale ? renderFinale() : ''}${renderFooter(page)}`;
  writeFileSync(join(__dirname, page.file), html);
  console.log('wrote', page.file, '(' + html.length + ' bytes)');
}
