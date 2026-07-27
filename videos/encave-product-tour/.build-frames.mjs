// Generates the 8 frame sub-compositions from one shared layout skeleton so the
// tour reads as a single system.
//
// Layout: text column left (kicker / serif display / sub / chips), the real
// captured screen right inside a hairline-elevated box. Everything sits above
// the 900px caption keep-out.
//
// Screen treatment: the box takes the capture's OWN aspect ratio, so at rest the
// whole screen is visible — nothing letterboxed, nothing cropped. Motion comes
// from a camera that travels to the UI element each chip names: it pushes in,
// a highlight ring lands on the element, and an oversized cursor points at it
// and clicks. Cropping only ever happens while deliberately zoomed in.
//
// Re-run after editing a frame spec below.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'compositions/frames';
fs.mkdirSync(OUT, { recursive: true });

const BOX_W = 1064;
const BOX_LEFT = 748;

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

// house arrow — white body, ink stroke (see /oversized-cursor)
const CURSOR_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 2.2 L5.5 19.4 L9.9 15.3 L12.7 21.6 L15.6 20.3 L12.8 14.1 L18.9 14.0 Z" fill="#FBF8F4" stroke="#1A0F12" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Camera solve: place source fraction (cx,cy) of the capture at the box centre
// at zoom z, without ever letting the image edge pull inside the box.
function camera(cx, cy, z, boxH) {
  const W = BOX_W * z;
  const H = boxH * z;
  const x = clamp(BOX_W / 2 - cx * W, BOX_W - W, 0);
  const y = clamp(boxH / 2 - cy * H, boxH - H, 0);
  return { x, y, W, H };
}

// Where a source-fraction region lands in box coords for a given camera.
function ringBox(region, cam, boxH) {
  const [fx0, fy0, fx1, fy1] = region;
  return {
    left: cam.x + fx0 * cam.W,
    top: cam.y + fy0 * cam.H,
    w: (fx1 - fx0) * cam.W,
    h: (fy1 - fy0) * cam.H,
  };
}

const FRAMES = [
  {
    id: '01-hook',
    duration: 7,
    kicker: 'Valais · Suisse',
    display: 'Le vin, <span class="CLS-em">chez ceux qui le font.</span>',
    sub: 'Dégustations, ateliers et visites de cave, réservés directement avec le vigneron.',
    stats: [
      ['600', 'caves valaisannes'],
      ['1', 'plateforme pour les réserver'],
    ],
    asset: 'assets/ui-home-hero.png',
    ratio: 1920 / 1080,
    // establishing shot: start slightly in, pull back to the whole page
    pullback: [1.07, 1.0],
  },
  {
    id: '02-catalogue',
    duration: 9,
    kicker: '01 — Découvrir',
    display: 'Chercher <span class="CLS-em">par envie.</span>',
    sub: 'Le catalogue se filtre comme on choisit une sortie, pas comme on fouille un annuaire.',
    asset: 'assets/ui-catalogue-grid.png',
    ratio: 1920 / 1080,
    beats: [
      { chip: 'Filtrer par type', c: [0.253, 0.325], z: 1.95, r: [0.185, 0.215, 0.325, 0.435] },
      { chip: 'Par commune, par date', c: [0.253, 0.60], z: 1.95, r: [0.185, 0.44, 0.325, 0.72] },
      { chip: 'Les résultats suivent', c: [0.63, 0.40], z: 1.3, r: [0.33, 0.06, 0.83, 0.58] },
    ],
  },
  {
    id: '03-reservation',
    duration: 12,
    kicker: '02 — Réserver',
    display: 'Trois gestes, <span class="CLS-em">prix complet.</span>',
    sub: 'Un jour, une heure, un nombre de personnes. Le total est affiché avant de payer.',
    asset: 'assets/ui-booking-panel-zoom.png',
    ratio: 1280 / 760,
    beats: [
      { chip: 'Un jour', c: [0.82, 0.27], z: 1.9, r: [0.655, 0.20, 0.985, 0.34] },
      { chip: 'Une heure', c: [0.82, 0.43], z: 1.9, r: [0.655, 0.36, 0.985, 0.50] },
      { chip: '4 personnes', c: [0.82, 0.58], z: 1.9, r: [0.655, 0.53, 0.985, 0.63] },
      { chip: 'Frais de service visibles', c: [0.82, 0.71], z: 1.9, r: [0.655, 0.64, 0.985, 0.78] },
    ],
  },
  {
    id: '04-bascule',
    duration: 5,
    pivot: true,
    kicker: 'La même réservation',
    display: 'Et côté <span class="CLS-em">cave&nbsp;?</span>',
  },
  {
    id: '05-dashboard',
    duration: 11,
    kicker: '03 — Piloter',
    display: 'La journée <span class="CLS-em">en un écran.</span>',
    sub: 'Ce que le client vient de réserver arrive ici, sans ressaisie ni tableur.',
    asset: 'assets/ui-dashboard-today.png',
    ratio: 1920 / 1080,
    beats: [
      { chip: 'Couverts à venir', c: [0.464, 0.35], z: 2.25, r: [0.365, 0.29, 0.563, 0.41] },
      { chip: 'CA du mois', c: [0.669, 0.35], z: 2.25, r: [0.570, 0.29, 0.768, 0.41] },
      { chip: 'Taux de remplissage', c: [0.875, 0.35], z: 2.25, r: [0.776, 0.29, 0.974, 0.41] },
    ],
  },
  {
    id: '06-experiences',
    duration: 10,
    kicker: '04 — Publier',
    display: 'Vos expériences, <span class="CLS-em">vos prix.</span>',
    sub: 'La cave publie, modifie et duplique son offre elle-même.',
    asset: 'assets/ui-dashboard-experiences.png',
    ratio: 1920 / 1080,
    beats: [
      { chip: 'Publié · brouillon · archivé', c: [0.79, 0.167], z: 2.3, r: [0.695, 0.135, 0.895, 0.20] },
      { chip: 'Modifier le prix', c: [0.263, 0.60], z: 2.2, r: [0.235, 0.565, 0.300, 0.640] },
      { chip: 'Créer une expérience', c: [0.566, 0.82], z: 1.75, r: [0.455, 0.675, 0.680, 0.965] },
    ],
  },
  {
    id: '07-suivi',
    duration: 8,
    kicker: '05 — Suivre',
    display: 'Chaque réservation, <span class="CLS-em">suivie.</span>',
    sub: 'Encaissée via Stripe, exportable quand vous voulez.',
    asset: 'assets/ui-dashboard-bookings-kpis.png',
    ratio: 1920 / 558,
    beats: [
      { chip: 'Total des réservations', c: [0.292, 0.641], z: 1.9, r: [0.159, 0.538, 0.425, 0.744] },
      { chip: 'À venir · 7 jours', c: [0.567, 0.641], z: 1.9, r: [0.434, 0.538, 0.700, 0.744] },
      { chip: 'Export CSV', c: [0.9375, 0.462], z: 1.9, r: [0.899, 0.430, 0.976, 0.493] },
    ],
  },
  {
    id: '08-cta',
    duration: 6,
    outro: true,
  },
];

function baseCss(id, boxH) {
  return `
    ${FONTS}
    #root { position:relative; width:1920px; height:1080px; overflow:hidden;
      font-family:'Nunito',sans-serif; }
    .${id}-ground { position:absolute; inset:0; background:${CREAM}; }
    .${id}-ground::after { content:''; position:absolute; inset:0;
      background:radial-gradient(1200px 700px at 88% 18%, rgba(122,27,59,0.055), transparent 70%); }

    .${id}-col { position:absolute; left:112px; top:212px; width:556px; }
    .${id}-kicker { display:flex; align-items:center; gap:14px;
      font-family:'JetBrains Mono',monospace; font-weight:500; font-size:26px;
      letter-spacing:0.16em; text-transform:uppercase; color:${ACCENT}; }
    .${id}-kicker .spike { font-size:30px; line-height:1; }
    .${id}-display { margin-top:26px; font-family:'Averia Serif Libre',serif;
      font-weight:400; font-size:78px; line-height:1.04; letter-spacing:-0.02em;
      color:${INK}; text-wrap:balance; }
    .${id}-display .${id}-em { color:${ACCENT}; }
    .${id}-sub { margin-top:26px; font-size:29px; line-height:1.5; color:${MUTED};
      max-width:500px; }
    .${id}-chips { margin-top:38px; display:flex; flex-direction:column; gap:14px; }
    .${id}-chip { display:inline-flex; align-items:center; gap:14px;
      background:${TILE}; border:1px solid rgba(26,15,18,0.12); border-radius:9999px;
      padding:14px 26px; font-size:26px; font-weight:600; color:${INK};
      align-self:flex-start; }
    .${id}-chip .dot { width:10px; height:10px; border-radius:50%; background:${ACCENT};
      flex:none; }

    .${id}-screen { position:absolute; left:${BOX_LEFT}px; top:${Math.round(540 - boxH / 2)}px;
      width:${BOX_W}px; height:${boxH}px;
      border:1px solid rgba(26,15,18,0.14); border-radius:14px; overflow:hidden;
      background:${CREAM};
      box-shadow:0 1px 3px rgba(26,15,18,0.08), 0 18px 48px rgba(26,15,18,0.10); }
    .${id}-shot { position:absolute; left:0; top:0; width:${BOX_W}px; height:${boxH}px;
      display:block; transform-origin:0 0; }

    .${id}-ring { position:absolute; border:3px solid ${ACCENT}; border-radius:10px;
      box-shadow:0 0 0 4px rgba(122,27,59,0.14), 0 0 26px rgba(122,27,59,0.22);
      pointer-events:none; opacity:0; }

    .${id}-cursor { position:absolute; left:0; top:0; width:98px; height:98px; z-index:20;
      filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3)); pointer-events:none;
      will-change:transform; opacity:0; }`;
}

function buildStandard(f) {
  const id = 'f' + f.id;
  const compId = f.id;
  const d = f.duration;
  const boxH = Math.round(BOX_W / f.ratio); // box takes the capture's own aspect
  const css = baseCss(id, boxH);
  const displayHtml = (f.display || '').replace(/CLS-em/g, `${id}-em`);
  const beats = f.beats || [];

  // ---- static geometry per beat -------------------------------------------
  const cams = beats.map((b) => camera(b.c[0], b.c[1], b.z, boxH));
  const rings = beats.map((b, i) => ringBox(b.r, cams[i], boxH));

  const chipsHtml = beats
    .map((b, i) => `      <div class="${id}-chip" id="${id}-chip-${i}"><span class="dot"></span>${b.chip}</div>`)
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

  const ringsHtml = rings
    .map(
      (r, i) =>
        `      <div class="${id}-ring" id="${id}-ring-${i}" style="left:${r.left.toFixed(0)}px; top:${r.top.toFixed(0)}px; width:${r.w.toFixed(0)}px; height:${r.h.toFixed(0)}px;"></div>`
    )
    .join('\n');

  const cursorHtml = beats.length
    ? `      <div class="${id}-cursor" id="${id}-cursor">${CURSOR_SVG}</div>`
    : '';

  const body = `
    <div class="${id}-ground clip" id="${id}-ground" data-start="0" data-duration="${d}" data-track-index="0"></div>

    <div class="${id}-col clip" id="${id}-col" data-start="0" data-duration="${d}" data-track-index="1">
      <div class="${id}-kicker" id="${id}-kicker"><span class="spike">✱</span><span>${f.kicker}</span></div>
      <div class="${id}-display" id="${id}-display">${displayHtml}</div>
${f.sub ? `      <div class="${id}-sub" id="${id}-sub">${f.sub}</div>` : ''}
${beats.length ? `      <div class="${id}-chips" id="${id}-chips">\n${chipsHtml}\n      </div>` : ''}
${f.stats ? `      <div class="${id}-stats" id="${id}-stats">\n${statsHtml}\n      </div>` : ''}
    </div>

    <div class="${id}-screen clip" id="${id}-screen" data-layout-allow-overflow data-start="0" data-duration="${d}" data-track-index="2">
      <img class="${id}-shot" id="${id}-shot" src="${f.asset}" alt="" />
${ringsHtml}
${cursorHtml}
    </div>`;

  // ---- timeline ------------------------------------------------------------
  let tw = `      tl.fromTo('#${id}-screen', { opacity:0, x:56 }, { opacity:1, x:0, duration:0.85, ease:'power3.out' }, 0.1);
      tl.fromTo('#${id}-kicker', { opacity:0, y:16 }, { opacity:1, y:0, duration:0.55, ease:'power2.out' }, 0.25);
      tl.fromTo('#${id}-display', { opacity:0, y:32 }, { opacity:1, y:0, duration:0.75, ease:'power3.out' }, 0.5);\n`;
  if (f.sub) {
    tw += `      tl.fromTo('#${id}-sub', { opacity:0, y:22 }, { opacity:1, y:0, duration:0.6, ease:'power2.out' }, 1.0);\n`;
  }

  if (!beats.length) {
    // establishing shot — pull back to reveal the whole page, so it ends uncropped
    const [z0, z1] = f.pullback || [1.06, 1.0];
    const c0 = camera(0.5, 0.5, z0, boxH);
    tw += `      tl.fromTo('#${id}-shot', { x:${c0.x.toFixed(1)}, y:${c0.y.toFixed(1)}, scale:${z0} }, { x:0, y:0, scale:${z1}, duration:${d}, ease:'none' }, 0);\n`;
  } else {
    // camera starts wide on the whole screen, then travels beat by beat
    const first = d * 0.26;
    const last = d * 0.84;
    const step = beats.length > 1 ? (last - first) / (beats.length - 1) : 0;

    tw += `      gsap.set('#${id}-shot', { x:0, y:0, scale:1, transformOrigin:'0 0' });\n`;

    beats.forEach((b, i) => {
      const at = first + step * i;
      const cam = cams[i];
      const r = rings[i];
      const move = i === 0 ? 1.05 : 0.9;
      // camera glide
      tw += `      tl.to('#${id}-shot', { x:${cam.x.toFixed(1)}, y:${cam.y.toFixed(1)}, scale:${b.z}, duration:${move}, ease:'power2.inOut' }, ${(at - 0.55).toFixed(2)});\n`;
      // chip lands with the camera
      tw += `      tl.fromTo('#${id}-chip-${i}', { opacity:0, x:-22 }, { opacity:1, x:0, duration:0.5, ease:'power2.out' }, ${at.toFixed(2)});\n`;

      // cursor: enter from below the box on beat 1, then travel between targets
      const tipX = r.left + r.w / 2;
      const tipY = r.top + r.h / 2;
      // the arrow tip sits at ~21%/14% of the svg box
      const cx = (tipX - 0.21 * 98).toFixed(0);
      const cy = (tipY - 0.14 * 98).toFixed(0);
      if (i === 0) {
        tw += `      tl.fromTo('#${id}-cursor', { opacity:1, x:${cx}, y:${(boxH + 130).toFixed(0)} }, { x:${cx}, y:${cy}, duration:0.9, ease:'power3.out', immediateRender:false }, ${(at - 0.5).toFixed(2)});\n`;
      } else {
        tw += `      tl.to('#${id}-cursor', { x:${cx}, y:${cy}, duration:0.75, ease:'power2.inOut' }, ${(at - 0.5).toFixed(2)});\n`;
      }
      // click tap — asymmetric compress/expand, pivoting on the tip
      tw += `      tl.to('#${id}-cursor', { scale:0.84, duration:0.1, ease:'power2.in', transformOrigin:'21% 14%', overwrite:'auto' }, ${(at + 0.05).toFixed(2)});\n`;
      tw += `      tl.to('#${id}-cursor', { scale:1, duration:0.22, ease:'power2.out', transformOrigin:'21% 14%', overwrite:'auto' }, ${(at + 0.15).toFixed(2)});\n`;
      // the ring is what the click causes
      tw += `      tl.fromTo('#${id}-ring-${i}', { opacity:0, scale:1.06, transformOrigin:'50% 50%' }, { opacity:1, scale:1, duration:0.4, ease:'power2.out' }, ${(at + 0.08).toFixed(2)});\n`;
      if (i < beats.length - 1) {
        tw += `      tl.to('#${id}-ring-${i}', { opacity:0, duration:0.35, ease:'power1.in' }, ${(at + step - 0.7).toFixed(2)});\n`;
      }
    });
  }

  return wrap(compId, d, css + statsCss, body, tw);
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
      <div class="${id}-display" id="${id}-display">${f.display.replace(/CLS-em/g, `${id}-em`)}</div>
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

  const tw = `      tl.fromTo('#${id}-mark', { opacity:0, y:28 }, { opacity:1, y:0, duration:0.8, ease:'power3.out' }, 0.2);
      tl.fromTo('#${id}-line', { opacity:0, y:26 }, { opacity:1, y:0, duration:0.8, ease:'power3.out' }, 1.1);
      tl.fromTo('#${id}-rule', { width:0 }, { width:420, duration:1.1, ease:'power2.inOut' }, 2.0);
      tl.fromTo('#${id}-url', { opacity:0, y:18 }, { opacity:1, y:0, duration:0.7, ease:'power2.out' }, 2.9);\n`;

  return wrap(compId, f.duration, css, body, tw);
}

function wrap(compId, duration, css, body, tweens) {
  return `<template>
  <style>${css}
  </style>

  <div
    id="root"
    data-composition-id="${compId}"
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
${tweens}      window.__timelines['${compId}'] = tl;
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
  fs.writeFileSync(path.join(OUT, `${f.id}.html`), html);
  const n = (f.beats || []).length;
  console.log(`wrote ${f.id}.html  ${f.duration}s` + (n ? `  ${n} camera beats` : ''));
}
console.log('total', FRAMES.reduce((a, f) => a + f.duration, 0) + 's');
