/**
 * List of communes in the Valais canton of Switzerland
 * These are the municipalities where wineries can be registered
 */

export const VALAIS_COMMUNES = [
  'Ardon',
  'Ayent',
  'Chamoson',
  'Charrat',
  'Conthey',
  'Evolène',
  'Fully',
  'Grimisuat',
  'Grône',
  'Icogne',
  'Lens',
  'Leuk',
  'Leytron',
  'Martigny',
  'Miège',
  'Montana',
  'Nendaz',
  'Orsières',
  'Riddes',
  'Saillon',
  'Saint-Léonard',
  'Saint-Maurice',
  'Salgesch',
  'Salvan',
  'Savièse',
  'Saxon',
  'Sembrancher',
  'Sierre',
  'Sion',
  'Uvrier',
  'Varen',
  'Venthône',
  'Vétroz',
  'Veyras',
  'Visp',
  'Visperterminen',
  'Vouvry',
  'Zermatt',
] as const;

export type ValaisCommune = (typeof VALAIS_COMMUNES)[number];

/**
 * Communes formatted for dropdown selection
 */
export const COMMUNE_OPTIONS = VALAIS_COMMUNES.map((commune) => ({
  value: commune,
  label: commune,
}));
