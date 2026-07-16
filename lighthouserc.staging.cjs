/**
 * LHCI — GATE stage (P-16 / L-182, blocking): measured against staging
 * (encave-dev.vercel.app) = CDN + ISR, the NFR truth per the P-06
 * decision. categories.performance ≥ 0.95 + LCP < 1.5 s on the discovery
 * pages + resource budgets, all `error`. If this gate fails after the
 * WS-F perf leviers are exhausted, the delivery-plan fuse applies
 * (launch 23.11) — never bypass it silently.
 *
 * URLs are overridable for the pre-launch run against production:
 *   LHCI_BASE_URL=https://encave.ch npx lhci autorun --config=lighthouserc.staging.cjs
 */
const BASE = process.env.LHCI_BASE_URL || 'https://encave-dev.vercel.app';

module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE}/fr`,
        `${BASE}/fr/experiences`,
        // A stable seeded fiche must exist on staging — adjust the slug if
        // the staging seed changes.
        `${BASE}/fr/experiences/${process.env.LHCI_FICHE_PATH || 'degustation-cave-du-rhodan'}`,
      ],
      numberOfRuns: 3,
      settings: {
        // Standard CI flags (rootless containers / GitHub runners).
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        preset: 'perf',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 1500 }],
        // Staging carries real content (home HTML ~198 KB post-P-06, real
        // photos) — wider byte budgets; the score + LCP above are the gate.
        'resource-summary:script:size': ['error', { maxNumericValue: 650_000 }],
        'resource-summary:document:size': [
          'error',
          { maxNumericValue: 250_000 },
        ],
        'resource-summary:font:size': ['error', { maxNumericValue: 330_000 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 900_000 }],
        'resource-summary:total:size': [
          'error',
          { maxNumericValue: 2_500_000 },
        ],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
