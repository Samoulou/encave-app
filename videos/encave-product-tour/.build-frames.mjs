// Generates the 8 frame sub-compositions from one shared layout skeleton so the
// tour reads as a single system. Layout: text column left, the real product
// screenshot right in a hairline-elevated "screen". Everything sits above the
// 900px caption keep-out. Re-run after editing a frame spec below.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'compositions/frames';
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `
    @font-face { font-family:'Averia Serif Libre'; font-style:normal; font-weight:400;
      src:url('assets/fonts/averia-serif-libre-400.woff2') format('woff2'); }
    @font-face { font-family:'Averia Serif Libre'; font-style:normal; font-weight:700;
      src:url('assets/fonts/averia-serif-libre-700.woff2') format('woff2'); }
    @font-face { font-family:'Nunito'; font-style:normal; font-weight:400 800;
      src:url('assets/fonts/nunito-400.woff2') format('woff2'); }
    @font-face { font-family:'JetBrains Mono'; font-style:normal; font-weight:400 700;
      src:url('assets/fonts/jetbrains-mono-400.woff2') format('woff2'); }`;

// design tokens, straight from frame.md
const INK = '#1A0F12';
const CREAM = '#FBF8F4';
const TILE = '#F3ECE0';
const ACCENT = '#7A1B3B';
const MUTED = '#6B4F56';

const baseCss = (id, screenH = 632, screenTop = 224) => `
    ${FONTS}
    #root { position:relative; width:1920px; height:1080px; overflow:hidden;
      font-family:'Nunito',sans-serif; }
    .${id}-ground { position:absolute; inset:0; background:${CREAM}; }
    .${id}-ground::after {
      content:''; position:absolute; inset:0;
      background:radial-gradient(1200px 700px at 88% 18%, rgba(122,27,59,0.055), transparent 70%);
    }

    .${id}-col { position:absolute; left:112px; top:212px; width:556px; }
    .${id}-kicker { display:flex; align-items:center; gap:14px;
      font-family:'JetBrains Mono',monospace; font-weight:500; font-size:26px;
      letter-spacing:0.16em; text-transform:uppercase; color:${ACCENT}; }
    .${id}-kicker .spike { font-size:30px; line-height:1; }
    .${id}-display { margin-top:26px; font-family:'Averia Serif Libre',serif;
      font-weight:400; font-size:78px; line-height:1.04; letter-spacing:-0.02em;
      color:${INK}; text-wrap:balance; }
    .${id}-display .em { color:${ACCENT}; }
    .${id}-sub { margin-top:26px; font-size:29px; line-height:1.5; color:${MUTED};
      max-width:500px; }
    .${id}-chips { margin-top:38px; display:flex; flex-direction:column; gap:14px; }
    .${id}-chip { display:inline-flex; align-items:center; gap:14px;
      background:${TILE}; border:1px solid rgba(26,15,18,0.12); border-radius:9999px;
      padding:14px 26px; font-size:26px; font-weight:600; color:${INK};
      align-self:flex-start; }
    .${id}-chip .dot { width:10px; height:10px; border-radius:50%; background:${ACCENT};
      flex:none; }

    .${id}-screen { position:absolute; left:748px; top:${screenTop}px; width:1064px; height:${screenH}px;
      border:1px solid rgba(26,15,18,0.14); border-radius:14px; overflow:hidden;
      background:#fff; box-shadow:0 1px 3px rgba(26,15,18,0.08), 0 18px 48px rgba(26,15,18,0.10); }
    .${id}-screen img { position:absolute; display:block; }`;

const screenImg = (id, spec, boxH = 632) => {
  // `fit: 'top'` shows the top of a 1920x1080 capture scaled to the box width.
  // `focus` zooms into a region of the capture: [scale, xPct, yPct].
  if (spec.focus) {
    const [sc, xp, yp] = spec.focus;
    const w = 1064 * sc;
    const h = w * (1080 / 1920);
    const left = -(w - 1064) * xp;
    const top = -(h - boxH) * yp;
    return `width:${w.toFixed(0)}px; height:${h.toFixed(0)}px; left:${left.toFixed(0)}px; top:${top.toFixed(0)}px;`;
  }
  if (spec.strip) {
    // a wide short capture (e.g. the 1920x430 KPI band) — fill width, center it
    const w = 1064;
    const h = w * (spec.stripRatio || 430 / 1920);
    return `width:${w}px; height:${h.toFixed(0)}px; left:0; top:${((boxH - h) / 2).toFixed(0)}px;`;
  }
  const w = 1064;
  const h = w / (spec.ratio || 1920 / 1080);
  return `width:${w}px; height:${h.toFixed(0)}px; left:0; top:${((boxH - h) / 2).toFixed(0)}px;`;
};

const FRAMES = [
  {
    id: '01-hook',
    duration: 7,
    kicker: 'Valais · Suisse',
    display: 'Le vin, <span class="CLS-display-em">chez ceux qui le font.</span>',
    sub: 'Dégustations, ateliers et visites de cave, réservés directement avec le vigneron.',
    chips: [],
    stats: [
      ['600', 'caves valaisannes'],
      ['1', 'plateforme pour les réserver'],
    ],
    asset: 'assets/ui-home-hero.png',
  },
  {
    id: '02-catalogue',
    duration: 9,
    kicker: '01 — Découvrir',
    display: 'Chercher <span class="CLS-display-em">par envie.</span>',
    sub: "Le catalogue se filtre comme on choisit une sortie, pas comme on fouille un annuaire.",
    chips: ['Par type d’expérience', 'Par commune', 'Par date', 'Par budget'],
    asset: 'assets/ui-catalogue-grid.png',
  },
  {
    id: '03-reservation',
    duration: 12,
    kicker: '02 — Réserver',
    display: 'Trois gestes, <span class="CLS-display-em">prix complet.</span>',
    sub: 'Un jour, une heure, un nombre de personnes. Le total est affiché avant de payer.',
    chips: ['Un jour', 'Une heure', '4 personnes', 'Frais de service visibles'],
    asset: 'assets/ui-booking-panel-zoom.png',
    ratio: 1280 / 760,
  },
  {
    id: '04-bascule',
    duration: 5,
    pivot: true,
    kicker: 'La même réservation',
    display: 'Et côté <span class="CLS-display-em">cave&nbsp;?</span>',
  },
  {
    id: '05-dashboard',
    duration: 11,
    kicker: '03 — Piloter',
    display: 'La journée <span class="CLS-display-em">en un écran.</span>',
    sub: "Ce que le client vient de réserver arrive ici, sans ressaisie ni tableur.",
    chips: ['Couverts à venir', 'CA du mois', 'Taux de remplissage'],
    asset: 'assets/ui-dashboard-today.png',
  },
  {
    id: '06-experiences',
    duration: 10,
    kicker: '04 — Publier',
    display: 'Vos expériences, <span class="CLS-display-em">vos prix.</span>',
    sub: 'La cave publie, modifie et duplique son offre elle-même.',
    chips: ['Créer une expérience', 'Modifier le prix', 'Dupliquer'],
    asset: 'assets/ui-dashboard-experiences.png',
  },
  {
    id: '07-suivi',
    duration: 8,
    kicker: '05 — Suivre',
    display: 'Chaque réservation, <span class="CLS-display-em">suivie.</span>',
    sub: 'Encaissée via Stripe, exportable quand vous voulez.',
    chips: ['Total des réservations', 'À venir · 7 jours', 'Export CSV'],
    asset: 'assets/ui-dashboard-bookings-kpis.png',
    strip: true,
    screenH: 260,
  },
  {
    id: '08-cta',
    duration: 6,
    outro: true,
  },
];

function buildStandard(f) {
  const id = 'f' + f.id;
  const compId = f.id;
  const screenH = f.screenH || 632;
  const screenTop = Math.round(224 + (632 - screenH) / 2);
  const css = baseCss(id, screenH, screenTop).replace(/CLS-display-em/g, `${id}-em`);
  const displayHtml = (f.display || '').replace(/CLS-display-em/g, `${id}-em`);

  const chipsHtml = (f.chips || [])
    .map(
      (c, i) =>
        `      <div class="${id}-chip" id="${id}-chip-${i}"><span class="dot"></span>${c}</div>`
    )
    .join('\n');

  const statsHtml = (f.stats || [])
    .map(
      (s, i) => `      <div class="${id}-stat" id="${id}-stat-${i}">
        <div class="fig">${s[0]}</div><div class="lab">${s[1]}</div>
      </div>`
    )
    .join('\n');

  const statsCss = f.stats
    ? `
    .${id}-stats { margin-top:44px; display:flex; gap:0; }
    .${id}-stat { padding-right:40px; margin-right:40px;
      border-right:1px solid rgba(26,15,18,0.16); }
    .${id}-stat:last-child { border-right:none; margin-right:0; padding-right:0; }
    .${id}-stat .fig { font-family:'Averia Serif Libre',serif; font-size:82px;
      line-height:1; color:${ACCENT}; letter-spacing:-0.025em; }
    .${id}-stat .lab { margin-top:8px; font-size:25px; color:${MUTED}; max-width:230px;
      line-height:1.35; }`
    : '';

  const imgStyle = f.asset ? screenImg(id, f, screenH) : '';

  const body = `
    <div class="${id}-ground clip" id="${id}-ground" data-start="0" data-duration="${f.duration}" data-track-index="0"></div>

    <div class="${id}-col clip" id="${id}-col" data-start="0" data-duration="${f.duration}" data-track-index="1">
      <div class="${id}-kicker" id="${id}-kicker"><span class="spike">✱</span><span>${f.kicker}</span></div>
      <div class="${id}-display" id="${id}-display">${displayHtml}</div>
${f.sub ? `      <div class="${id}-sub" id="${id}-sub">${f.sub}</div>` : ''}
${f.chips && f.chips.length ? `      <div class="${id}-chips" id="${id}-chips">\n${chipsHtml}\n      </div>` : ''}
${f.stats ? `      <div class="${id}-stats" id="${id}-stats">\n${statsHtml}\n      </div>` : ''}
    </div>

    <div class="${id}-screen clip" id="${id}-screen" data-layout-allow-overflow data-start="0" data-duration="${f.duration}" data-track-index="2">
      <img id="${id}-shot" src="${f.asset}" alt="" style="${imgStyle}" />
    </div>`;

  // timeline: screen first (hero visible early), then kicker/display, then the
  // chips or stats staggered across the back half so the shot keeps arriving.
  const d = f.duration;
  const items = f.chips && f.chips.length ? f.chips.length : (f.stats || []).length;
  const firstReveal = d * 0.32;
  // few items shouldn't be strung out to the very end of the shot
  const lastReveal = d * (items <= 2 ? 0.58 : 0.82);
  const gap = items > 1 ? (lastReveal - firstReveal) / (items - 1) : 0;

  let tw = `      tl.fromTo('#${id}-screen', { opacity:0, x:56, scale:0.985 }, { opacity:1, x:0, scale:1, duration:0.85, ease:'power3.out' }, 0.1);
      tl.fromTo('#${id}-shot', { scale:1.05 }, { scale:1, duration:${d}, ease:'none' }, 0);
      tl.fromTo('#${id}-kicker', { opacity:0, y:16 }, { opacity:1, y:0, duration:0.55, ease:'power2.out' }, 0.25);
      tl.fromTo('#${id}-display', { opacity:0, y:32 }, { opacity:1, y:0, duration:0.75, ease:'power3.out' }, 0.5);\n`;
  if (f.sub) {
    tw += `      tl.fromTo('#${id}-sub', { opacity:0, y:22 }, { opacity:1, y:0, duration:0.6, ease:'power2.out' }, 1.0);\n`;
  }
  const prefix = f.chips && f.chips.length ? 'chip' : 'stat';
  for (let i = 0; i < items; i++) {
    const at = (firstReveal + gap * i).toFixed(2);
    tw += `      tl.fromTo('#${id}-${prefix}-${i}', { opacity:0, x:-22 }, { opacity:1, x:0, duration:0.5, ease:'power2.out' }, ${at});\n`;
  }

  return wrap(compId, f.duration, css + statsCss, body, tw);
}

function buildPivot(f) {
  const id = 'f' + f.id;
  const compId = f.id;
  const css = `
    ${FONTS}
    #root { position:relative; width:1920px; height:1080px; overflow:hidden;
      font-family:'Nunito',sans-serif; }
    .${id}-ground { position:absolute; inset:0; background:${INK}; }
    .${id}-ground::after { content:''; position:absolute; inset:0;
      background:radial-gradient(900px 620px at 50% 44%, rgba(122,27,59,0.42), transparent 72%); }
    .${id}-wrap { position:absolute; left:0; right:0; top:330px; text-align:center; }
    .${id}-kicker { font-family:'JetBrains Mono',monospace; font-weight:500; font-size:26px;
      letter-spacing:0.18em; text-transform:uppercase; color:#E0899F; }
    .${id}-display { margin-top:34px; font-family:'Averia Serif Libre',serif; font-weight:400;
      font-size:152px; line-height:1.0; letter-spacing:-0.025em; color:${CREAM}; }
    .${id}-display .${id}-em { color:#E8B7C4; }
    .${id}-rule { margin:52px auto 0; width:0; height:1px; background:rgba(251,248,244,0.34); }`;

  const body = `
    <div class="${id}-ground clip" id="${id}-ground" data-start="0" data-duration="${f.duration}" data-track-index="0"></div>
    <div class="${id}-wrap clip" id="${id}-wrap" data-start="0" data-duration="${f.duration}" data-track-index="1">
      <div class="${id}-kicker" id="${id}-kicker">${f.kicker}</div>
      <div class="${id}-display" id="${id}-display">${f.display.replace(/CLS-display-em/g, `${id}-em`)}</div>
      <div class="${id}-rule" id="${id}-rule"></div>
    </div>`;

  const tw = `      tl.fromTo('#${id}-kicker', { opacity:0, y:18 }, { opacity:1, y:0, duration:0.6, ease:'power2.out' }, 0.15);
      tl.fromTo('#${id}-display', { opacity:0, y:44, scale:0.965 }, { opacity:1, y:0, scale:1, duration:0.95, ease:'power3.out' }, 0.5);
      tl.fromTo('#${id}-rule', { width:0 }, { width:520, duration:1.5, ease:'power2.inOut' }, 1.7);\n`;

  return wrap(compId, f.duration, css, body, tw);
}

function buildOutro(f) {
  const id = 'f' + f.id;
  const compId = f.id;
  const css = `
    ${FONTS}
    #root { position:relative; width:1920px; height:1080px; overflow:hidden;
      font-family:'Nunito',sans-serif; }
    .${id}-ground { position:absolute; inset:0; background:${CREAM}; }
    .${id}-ground::after { content:''; position:absolute; inset:0;
      background:radial-gradient(1100px 640px at 50% 40%, rgba(122,27,59,0.07), transparent 72%); }
    .${id}-wrap { position:absolute; left:0; right:0; top:300px; text-align:center; }
    .${id}-mark { font-family:'Averia Serif Libre',serif; font-weight:700; font-size:104px;
      line-height:1; color:${ACCENT}; letter-spacing:-0.02em; }
    .${id}-line { margin-top:44px; font-family:'Averia Serif Libre',serif; font-weight:400;
      font-size:64px; line-height:1.18; color:${INK}; letter-spacing:-0.015em; }
    .${id}-rule { margin:52px auto 0; width:0; height:1px; background:rgba(26,15,18,0.2); }
    .${id}-url { margin-top:44px; font-family:'JetBrains Mono',monospace; font-weight:500;
      font-size:40px; letter-spacing:0.1em; color:${ACCENT}; }`;

  const body = `
    <div class="${id}-ground clip" id="${id}-ground" data-start="0" data-duration="${f.duration}" data-track-index="0"></div>
    <div class="${id}-wrap clip" id="${id}-wrap" data-start="0" data-duration="${f.duration}" data-track-index="1">
      <div class="${id}-mark" id="${id}-mark">EnCave</div>
      <div class="${id}-line" id="${id}-line">Le vin, chez ceux qui le font.</div>
      <div class="${id}-rule" id="${id}-rule"></div>
      <div class="${id}-url" id="${id}-url">encave.ch</div>
    </div>`;

  // final frame — a settle is allowed here
  const tw = `      tl.fromTo('#${id}-mark', { opacity:0, y:28 }, { opacity:1, y:0, duration:0.8, ease:'power3.out' }, 0.2);
      tl.fromTo('#${id}-line', { opacity:0, y:26 }, { opacity:1, y:0, duration:0.8, ease:'power3.out' }, 1.1);
      tl.fromTo('#${id}-rule', { width:0 }, { width:420, duration:1.1, ease:'power2.inOut' }, 2.0);
      tl.fromTo('#${id}-url', { opacity:0, y:18 }, { opacity:1, y:0, duration:0.7, ease:'power2.out' }, 2.9);\n`;

  return wrap(compId, f.duration, css, body, tw);
}

function wrap(id, duration, css, body, tweens) {
  return `<template>
  <style>${css}
  </style>

  <div
    id="root"
    data-composition-id="${id}"
    data-start="0"
    data-duration="${duration}"
    data-width="1920"
    data-height="1080"
  >
${body}
  </div>

  <script src="vendor/gsap.min.js"></script>
  <script>
    (function () {
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
${tweens}      window.__timelines['${id}'] = tl;
    })();
  </script>
</template>
`;
}

for (const f of FRAMES) {
  let html;
  if (f.pivot) html = buildPivot(f);
  else if (f.outro) html = buildOutro(f);
  else html = buildStandard(f);
  const file = path.join(OUT, `${f.id}.html`);
  fs.writeFileSync(file, html);
  console.log('wrote', file, `(${f.duration}s)`);
}
console.log('total', FRAMES.reduce((a, f) => a + f.duration, 0) + 's');
