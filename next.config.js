const { withSentryConfig } = require('@sentry/nextjs');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Build connect-src for CSP — auth calls always use same origin so no extra
// entry is needed for the auth URL.
const connectSrc = [
  "'self'",
  'https://api.stripe.com',
  'https://checkout.stripe.com',
  'https://*.vercel-insights.com',
  'https://*.vercel-analytics.com',
  'https://*.ingest.sentry.io',
  'https://api.mapbox.com',
  'https://events.mapbox.com',
  'https://*.tiles.mapbox.com',
  // Map fallback style without Mapbox token (InteractiveMap.tsx) — L-217
  'https://tile.openstreetmap.org',
  'https://*.tile.openstreetmap.org',
  'https://*.basemaps.cartocdn.com',
  'https://demotiles.maplibre.org',
];

// Security headers configuration (SEC-003)
const isDev = process.env.NODE_ENV === 'development';
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // browser.sentry-cdn.com: lazy-loaded Session Replay integration (L-205)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com https://eu.posthog.com https://eu-assets.i.posthog.com https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data: blob:",
      "font-src 'self' https: data:",
      `connect-src ${connectSrc.join(' ')}`,
      'frame-src https://js.stripe.com https://hooks.stripe.com https://www.openstreetmap.org',
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), microphone=(), camera=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Externalize pino and thread-stream to prevent worker path resolution issues
    // when Next.js bundles them into vendor-chunks (thread-stream spawns workers
    // using __dirname which breaks when bundled)
    serverComponentsExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days instead of the 60 s default (L-215)
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        // P-16 (WS-I): canonical host is the apex — belt-and-braces with
        // the Vercel domain-level redirect (ops). 308 keeps method+body.
        source: '/:path*',
        has: [{ type: 'host', value: 'www.encave.ch' }],
        destination: 'https://encave.ch/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = withSentryConfig(withNextIntl(nextConfig), {
  // Suppress source maps upload logs during build
  silent: !process.env.CI,

  // Upload source maps to Sentry for readable stack traces
  // SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT must be set in Vercel env
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Hide source maps from the client bundle (security)
  hideSourceMaps: true,

  // Route browser Sentry requests through a Next.js rewrite to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Webpack-specific Sentry options
  webpack: {
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
    autoInstrumentAppDirectory: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
