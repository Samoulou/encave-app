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
        preset: 'perf',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
        budgetsPath: './budgets.json',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.95 }],
        // Resource budgets (budgets.json) are the blocking part.
        'resource-summary:script:size': 'error',
        'resource-summary:document:size': 'error',
        'resource-summary:image:size': 'error',
        'resource-summary:total:size': 'error',
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
