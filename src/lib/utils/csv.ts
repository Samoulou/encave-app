/**
 * CSV cell helpers for the winemaker exports (bookings, earnings).
 *
 * Formula injection (pre-launch audit, M5): spreadsheet apps evaluate a
 * cell that starts with `=`, `+`, `-`, `@`, TAB or CR as a formula. Guest
 * controlled values (visitor name, email, phone) and winemaker-controlled
 * ones (experience title) end up in these exports, so
 * `=HYPERLINK(…)` / `+cmd|…` typed into a booking form would run when the
 * winemaker opens the file. Such cells are prefixed with an apostrophe
 * (OWASP recommendation) so they are read as text.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Signed numbers and phone numbers (`+41 27 123 45 67`, `-12.50`) start
 * with a trigger character but can only ever evaluate to a number — no
 * function call, no reference, no DDE. Left untouched so phone columns
 * stay clean.
 */
const HARMLESS_NUMERIC = /^[+-]?[\d\s().\/-]*\d[\d\s().\/-]*$/;

/** Prefix a formula-looking value with `'` so it is imported as text. */
export function neutralizeCsvFormula(value: string): string {
  // Leading whitespace is ignored by some importers — test the trimmed
  // value so ` =1+1` is neutralized too.
  const trimmed = value.trimStart();
  if (!FORMULA_TRIGGER.test(trimmed) && !FORMULA_TRIGGER.test(value)) {
    return value;
  }
  if (HARMLESS_NUMERIC.test(trimmed)) {
    return value;
  }
  return `'${value}`;
}

/**
 * One CSV cell: formula-neutralized, then RFC 4180 quoting (comma, quote,
 * CR or LF → wrapped in double quotes, inner quotes doubled).
 */
export function escapeCsvField(value: string): string {
  const safe = neutralizeCsvFormula(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
