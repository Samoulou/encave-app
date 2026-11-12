/**
 * Serialize structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is NOT safe there: it leaves `<` untouched, so a
 * user-controlled string (experience title, winery description…) containing
 * `</script><script>…` closes the JSON-LD block and runs as script (stored
 * XSS). Escaping `<`, `>` and `&` as JSON unicode escapes keeps the payload
 * byte-for-byte equivalent once parsed while making it impossible to leave
 * the script element. U+2028/U+2029 are escaped for legacy JS parsers.
 *
 * Use this for EVERY `dangerouslySetInnerHTML` JSON-LD block.
 */
const JSON_LD_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data) ?? 'null';
  return json.replace(
    /[<>&\u2028\u2029]/g,
    (char) => JSON_LD_ESCAPES[char] ?? char
  );
}
