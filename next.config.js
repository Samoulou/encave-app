const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Build connect-src dynamically so Vercel preview deployments can reach the
// auth API when NEXT_PUBLIC_BETTER_AUTH_URL differs from the page origin.
const connectSrc = [
  "'self'",
  'https://api.stripe.com',
  'https://checkout.stripe.com',
  'https://*.vercel-insights.com',
  'https://*.vercel-analytics.com',
  'https://*.ingest.sentry.io',
];

if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
  connectSrc.push(process.env.NEXT_PUBLIC_BETTER_AUTH_URL);
}

if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  connectSrc.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

// Security headers configuration (SEC-003)
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data: blob:",
      "font-src 'self' https: data:",
      `connect-src ${connectSrc.join(' ')}`,
      'frame-src https://js.stripe.com https://hooks.stripe.com https://www.openstreetmap.org',
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
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
    value: 'geolocation=(), microphone=(), camera=()',
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
};

module.exports = withNextIntl(nextConfig);
