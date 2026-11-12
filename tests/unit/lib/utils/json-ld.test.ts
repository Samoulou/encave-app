/**
 * Security regression (pre-launch audit, H1): JSON-LD blocks embed
 * user-controlled strings — the serializer must make it impossible to
 * close the surrounding <script> element.
 */
import { describe, it, expect } from 'vitest';
import { serializeJsonLd } from '@/lib/utils/json-ld';

describe('serializeJsonLd', () => {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: '</script><script>alert(1)</script>',
    description: 'Dégustation <b>Fendant</b> & Petite Arvine <!-- x -->',
  };

  it('never emits a raw <, > or & (no </script> breakout, no HTML comment)', () => {
    const out = serializeJsonLd(payload);
    expect(out).not.toMatch(/[<>&]/);
    expect(out.toLowerCase()).not.toContain('</script');
    expect(out).toContain('\\u003c/script\\u003e');
  });

  it('round-trips to the exact original data once parsed', () => {
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it('escapes the JS line separators U+2028 / U+2029', () => {
    const out = serializeJsonLd({ name: 'a\u2028b\u2029c' });
    expect(out).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(out)).toEqual({ name: 'a\u2028b\u2029c' });
  });

  it('leaves ordinary structured data untouched', () => {
    const data = { '@type': 'Winery', name: 'Cave du Rhône', price: 2500 };
    expect(serializeJsonLd(data)).toBe(JSON.stringify(data));
  });

  it('serializes undefined as null instead of the string "undefined"', () => {
    expect(serializeJsonLd(undefined)).toBe('null');
  });
});
