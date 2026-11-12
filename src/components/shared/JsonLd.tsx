import { serializeJsonLd } from '@/lib/utils/json-ld';

/**
 * SEO-001 to SEO-005: JSON-LD Structured Data Component
 * Renders schema.org structured data for SEO. The payload carries
 * user-controlled strings (titles, descriptions) — always serialized with
 * serializeJsonLd so `</script>` can never break out of the block.
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
