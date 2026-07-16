/**
 * LHCI — PR stage (P-16 / L-182): runs against the local production build
 * in CI. The Lantern mobile simulation is a KNOWN artifact on this app
 * (home simulated ~73 while every observed metric is green — see
 * docs/archive/plans/P-06-performance.md), so the SCORE asserts are
 * warn-only here; the blocking gate is the resource budgets (JS/doc
 * weight — insensitive to Lantern) plus the ≥ 95 staging config
 * (lighthouserc.staging.cjs), which measures the CDN/ISR truth.
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/fr',
        'http://localhost:3000/fr/experiences',
        'http://localhost:3000/fr/experiences/wine-tasting-test',
      ],
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready in',
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
        'categories:performance': ['warn', { minScore: 0.95 }],
        // Blocking regression budgets — calibrated on the seeded local
        // baseline (P-16: script 516 KB / doc 33 KB / font 296 KB) +10-15%
        // headroom. maxNumericValue is in BYTES; budgets.json is NOT wired
        // by LHCI (the performance-budget audit stays informative), the
        // resource-summary assertions are the enforcement mechanism.
        'resource-summary:script:size': ['error', { maxNumericValue: 580_000 }],
        'resource-summary:document:size': [
          'error',
          { maxNumericValue: 80_000 },
        ],
        'resource-summary:stylesheet:size': [
          'error',
          { maxNumericValue: 40_000 },
        ],
        'resource-summary:font:size': ['error', { maxNumericValue: 330_000 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 250_000 }],
        'resource-summary:total:size': [
          'error',
          { maxNumericValue: 1_300_000 },
        ],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
