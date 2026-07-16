import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://encave.ch';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /coming-soon: pre-launch gate page — never index (P-16 / WS-H)
        disallow: [
          '/api/',
          '/dashboard/',
          '/admin/',
          '/_next/',
          '/coming-soon',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
