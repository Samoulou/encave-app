import { describe, expect, it } from 'vitest';
import * as translations from '@/emails/translations';

/**
 * Regression guard on the email copy (pre-launch audit H6): the oldest
 * blocks of translations.ts shipped in ASCII French ("Reservation
 * confirmee!") and umlaut-less German ("Bestatigung", "fur"). This walks
 * EVERY string of the module, so a new block pasted without diacritics
 * fails here instead of in a customer's inbox.
 */

type Leaf = { locale: 'FR' | 'DE' | 'EN'; path: string; value: string };

function collect(node: unknown, path: string, out: Leaf[]): void {
  if (node === null || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key === 'FR' || key === 'DE' || key === 'EN') {
      const values = Array.isArray(value) ? value : [value];
      for (const entry of values) {
        if (typeof entry === 'string') {
          out.push({ locale: key, path: childPath, value: entry });
        }
      }
    } else {
      collect(value, childPath, out);
    }
  }
}

const leaves: Leaf[] = [];
for (const [name, value] of Object.entries(translations)) {
  if (typeof value === 'object') collect(value, name, leaves);
}

// Words that only exist WITH a diacritic in French. `\b` is ASCII-only in
// JS, which is exactly what we want: "réservation" contains no match for
// /\breservation\b/ because "é" is not a word character.
const UNACCENTED_FR =
  /\b(reservations?|experiences?|degustations?|recue?s?|annulee?s?|confirmee?s?|verifiee?s?|verifie[rz]?|resume|apercu|activites?|derniere|decouvr\w*|equipe|hesitez|deja|interet|apres|decision|supplementaires?|reinitialis\w*|aupres|bientot|hate|details|reference|duree|fonctionnalite|esperons|creer|gerer|completer|acceder|disponibilites|desinscrire|a venir|a ete|a jour)\b/i;

// Words that only exist WITH an umlaut in German.
const UMLAUTLESS_DE =
  /\b(fur|uber|ubersicht|konnen|mochten|zurucksetz\w*|zurucksetzung|lauft|bestatig\w*|gaste|grussen|zahlt|wochentliche?|aktivitat\w*|ruckerstattung|prufung|zusatzliche?|schaltflache|verfugbar\w*|vervollstandigen|gemass)\b/i;

describe('email translations — diacritics', () => {
  it('finds the three locales in the module (the walker works)', () => {
    expect(leaves.filter((l) => l.locale === 'FR').length).toBeGreaterThan(150);
    expect(leaves.filter((l) => l.locale === 'DE').length).toBeGreaterThan(150);
    expect(leaves.filter((l) => l.locale === 'EN').length).toBeGreaterThan(150);
  });

  it('has no ASCII-only French word that requires an accent', () => {
    const offenders = leaves
      .filter((l) => l.locale === 'FR')
      // {reference} & co. are interpolation placeholders, not copy.
      .filter((l) => UNACCENTED_FR.test(l.value.replace(/\{\w+\}/g, '')))
      .map((l) => `${l.path}: ${l.value}`);
    expect(offenders).toEqual([]);
  });

  it('has no umlaut-less German word, and no ß (Swiss German uses ss)', () => {
    const german = leaves.filter((l) => l.locale === 'DE');
    expect(
      german
        .filter((l) => UMLAUTLESS_DE.test(l.value))
        .map((l) => `${l.path}: ${l.value}`)
    ).toEqual([]);
    expect(
      german.filter((l) => l.value.includes('ß')).map((l) => l.path)
    ).toEqual([]);
  });

  it('email #1 — the confirmation — reads as proper French', () => {
    expect(translations.subjects.bookingConfirmation.FR).toBe(
      'Confirmation de votre réservation'
    );
    expect(translations.bookingConfirmation.title.FR).toBe(
      'Réservation confirmée !'
    );
    expect(translations.bookingConfirmation.intro.FR).toBe(
      'Votre réservation a été confirmée avec succès.'
    );
  });

  it('every entry is translated in the three locales', () => {
    const byPath = new Map<string, Set<string>>();
    for (const leaf of leaves) {
      const parent = leaf.path.replace(/\.(FR|DE|EN)$/, '');
      byPath.set(parent, (byPath.get(parent) ?? new Set()).add(leaf.locale));
    }
    const incomplete = [...byPath]
      .filter(([, locales]) => locales.size !== 3)
      .map(([path]) => path);
    expect(incomplete).toEqual([]);
  });
});
