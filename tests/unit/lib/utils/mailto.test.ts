import { describe, expect, it } from 'vitest';
import { buildMailtoLink, isSafeMailtoLength } from '@/lib/utils/mailto';

describe('mailto utils', () => {
  it('builds a BCC-only mailto link with encoded subject and body', () => {
    const link = buildMailtoLink({
      to: 'owner@encave.ch',
      bcc: ['a@example.com', 'b@example.com'],
      subject: '[EnCave] Degustation - 19 mai',
      body: 'Bonjour,\n\nMessage',
    });

    expect(link).toContain('mailto:owner%40encave.ch?');
    expect(link).toContain('bcc=a%40example.com%2Cb%40example.com');
    expect(link).toContain('subject=%5BEnCave%5D+Degustation+-+19+mai');
    expect(link).toContain('body=Bonjour%2C%0A%0AMessage');
  });

  it('flags long mailto links for copy-paste fallback', () => {
    expect(isSafeMailtoLength('x'.repeat(1800))).toBe(true);
    expect(isSafeMailtoLength('x'.repeat(1801))).toBe(false);
  });
});
