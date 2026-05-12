/**
 * Expanded location data for Valais region
 * Includes cities, villages, and communes with coordinates
 * Used for location-based autocomplete and proximity search
 */

export type LocationType = 'city' | 'village' | 'commune';

export interface ValaisLocation {
  id: string; // slug: "uvrier"
  name: string; // "Uvrier"
  type: LocationType;
  parentCommune: string | null; // "Sion" for villages
  latitude: number;
  longitude: number;
  searchTerms?: string[]; // Alternative spellings/names
}

/**
 * Comprehensive list of Valais locations
 * Includes all 37 existing communes plus major villages
 * Coordinates sourced from OpenStreetMap
 */
export const VALAIS_LOCATIONS: ValaisLocation[] = [
  // Major cities
  {
    id: 'sion',
    name: 'Sion',
    type: 'city',
    parentCommune: null,
    latitude: 46.2333,
    longitude: 7.3667,
    searchTerms: ['Sitten'],
  },
  {
    id: 'sierre',
    name: 'Sierre',
    type: 'city',
    parentCommune: null,
    latitude: 46.2922,
    longitude: 7.535,
    searchTerms: ['Siders'],
  },
  {
    id: 'martigny',
    name: 'Martigny',
    type: 'city',
    parentCommune: null,
    latitude: 46.103,
    longitude: 7.072,
    searchTerms: ['Martinach'],
  },
  {
    id: 'visp',
    name: 'Visp',
    type: 'city',
    parentCommune: null,
    latitude: 46.2942,
    longitude: 7.8814,
    searchTerms: ['Viège'],
  },
  {
    id: 'monthey',
    name: 'Monthey',
    type: 'city',
    parentCommune: null,
    latitude: 46.2548,
    longitude: 6.9542,
  },
  {
    id: 'brig',
    name: 'Brig',
    type: 'city',
    parentCommune: null,
    latitude: 46.3167,
    longitude: 7.9833,
    searchTerms: ['Brigue'],
  },

  // Communes (wine-producing regions)
  {
    id: 'ardon',
    name: 'Ardon',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2097,
    longitude: 7.2597,
  },
  {
    id: 'ayent',
    name: 'Ayent',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2833,
    longitude: 7.4167,
  },
  {
    id: 'chamoson',
    name: 'Chamoson',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2025,
    longitude: 7.2206,
  },
  {
    id: 'charrat',
    name: 'Charrat',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1167,
    longitude: 7.1333,
  },
  {
    id: 'conthey',
    name: 'Conthey',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2247,
    longitude: 7.3033,
    searchTerms: ['Gundis'],
  },
  {
    id: 'evolene',
    name: 'Evolène',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1117,
    longitude: 7.4931,
  },
  {
    id: 'fully',
    name: 'Fully',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1333,
    longitude: 7.1167,
  },
  {
    id: 'grimisuat',
    name: 'Grimisuat',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2594,
    longitude: 7.3836,
  },
  {
    id: 'grone',
    name: 'Grône',
    type: 'commune',
    parentCommune: null,
    latitude: 46.25,
    longitude: 7.4667,
  },
  {
    id: 'icogne',
    name: 'Icogne',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3,
    longitude: 7.4333,
  },
  {
    id: 'lens',
    name: 'Lens',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2833,
    longitude: 7.45,
  },
  {
    id: 'leuk',
    name: 'Leuk',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3167,
    longitude: 7.6333,
    searchTerms: ['Loèche'],
  },
  {
    id: 'leytron',
    name: 'Leytron',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1833,
    longitude: 7.2,
  },
  {
    id: 'miege',
    name: 'Miège',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3167,
    longitude: 7.55,
  },
  {
    id: 'montana',
    name: 'Montana',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3108,
    longitude: 7.4858,
    searchTerms: ['Crans-Montana'],
  },
  {
    id: 'nendaz',
    name: 'Nendaz',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1858,
    longitude: 7.305,
  },
  {
    id: 'orsieres',
    name: 'Orsières',
    type: 'commune',
    parentCommune: null,
    latitude: 46.0333,
    longitude: 7.15,
  },
  {
    id: 'riddes',
    name: 'Riddes',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1722,
    longitude: 7.2239,
  },
  {
    id: 'saillon',
    name: 'Saillon',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1667,
    longitude: 7.1833,
  },
  {
    id: 'saint-leonard',
    name: 'Saint-Léonard',
    type: 'commune',
    parentCommune: null,
    latitude: 46.25,
    longitude: 7.4167,
  },
  {
    id: 'saint-maurice',
    name: 'Saint-Maurice',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2167,
    longitude: 7.0,
  },
  {
    id: 'salgesch',
    name: 'Salgesch',
    type: 'commune',
    parentCommune: null,
    latitude: 46.31,
    longitude: 7.57,
    searchTerms: ['Salquenen'],
  },
  {
    id: 'salvan',
    name: 'Salvan',
    type: 'commune',
    parentCommune: null,
    latitude: 46.1167,
    longitude: 7.0167,
  },
  {
    id: 'saviese',
    name: 'Savièse',
    type: 'commune',
    parentCommune: null,
    latitude: 46.25,
    longitude: 7.35,
  },
  {
    id: 'saxon',
    name: 'Saxon',
    type: 'commune',
    parentCommune: null,
    latitude: 46.15,
    longitude: 7.1667,
  },
  {
    id: 'sembrancher',
    name: 'Sembrancher',
    type: 'commune',
    parentCommune: null,
    latitude: 46.0833,
    longitude: 7.15,
  },
  {
    id: 'varen',
    name: 'Varen',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3167,
    longitude: 7.6,
  },
  {
    id: 'venthone',
    name: 'Venthône',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3,
    longitude: 7.5333,
  },
  {
    id: 'vetroz',
    name: 'Vétroz',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2167,
    longitude: 7.2833,
  },
  {
    id: 'veyras',
    name: 'Veyras',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3,
    longitude: 7.5333,
  },
  {
    id: 'visperterminen',
    name: 'Visperterminen',
    type: 'commune',
    parentCommune: null,
    latitude: 46.25,
    longitude: 7.9,
  },
  {
    id: 'vouvry',
    name: 'Vouvry',
    type: 'commune',
    parentCommune: null,
    latitude: 46.3333,
    longitude: 6.8833,
  },
  {
    id: 'zermatt',
    name: 'Zermatt',
    type: 'commune',
    parentCommune: null,
    latitude: 46.0167,
    longitude: 7.75,
  },

  // Villages within communes
  {
    id: 'uvrier',
    name: 'Uvrier',
    type: 'village',
    parentCommune: 'Sion',
    latitude: 46.2412,
    longitude: 7.4186,
  },
  {
    id: 'bramois',
    name: 'Bramois',
    type: 'village',
    parentCommune: 'Sion',
    latitude: 46.2333,
    longitude: 7.4,
  },
  {
    id: 'pont-de-la-morge',
    name: 'Pont-de-la-Morge',
    type: 'village',
    parentCommune: 'Conthey',
    latitude: 46.2197,
    longitude: 7.31,
  },
  {
    id: 'plan-conthey',
    name: 'Plan-Conthey',
    type: 'village',
    parentCommune: 'Conthey',
    latitude: 46.23,
    longitude: 7.3,
  },
  {
    id: 'saint-pierre-de-clages',
    name: 'Saint-Pierre-de-Clages',
    type: 'village',
    parentCommune: 'Chamoson',
    latitude: 46.195,
    longitude: 7.2119,
  },
  {
    id: 'magnot',
    name: 'Magnot',
    type: 'village',
    parentCommune: 'Chamoson',
    latitude: 46.2,
    longitude: 7.21,
  },
  {
    id: 'vercorin',
    name: 'Vercorin',
    type: 'village',
    parentCommune: 'Chalais',
    latitude: 46.2667,
    longitude: 7.5333,
  },
  {
    id: 'chalais',
    name: 'Chalais',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2667,
    longitude: 7.5167,
  },
  {
    id: 'noës',
    name: 'Noës',
    type: 'village',
    parentCommune: 'Sierre',
    latitude: 46.2833,
    longitude: 7.55,
  },
  {
    id: 'muraz',
    name: 'Muraz',
    type: 'village',
    parentCommune: 'Sierre',
    latitude: 46.295,
    longitude: 7.51,
  },
  {
    id: 'granges',
    name: 'Granges',
    type: 'village',
    parentCommune: 'Sierre',
    latitude: 46.2667,
    longitude: 7.4667,
  },
  {
    id: 'crans',
    name: 'Crans',
    type: 'village',
    parentCommune: 'Montana',
    latitude: 46.3067,
    longitude: 7.4731,
    searchTerms: ['Crans-Montana'],
  },
  {
    id: 'flanthey',
    name: 'Flanthey',
    type: 'village',
    parentCommune: 'Lens',
    latitude: 46.2667,
    longitude: 7.45,
  },
  {
    id: 'chelin',
    name: 'Chelin',
    type: 'village',
    parentCommune: 'Lens',
    latitude: 46.28,
    longitude: 7.44,
  },
  {
    id: 'saint-clement',
    name: 'Saint-Clément',
    type: 'village',
    parentCommune: 'Ayent',
    latitude: 46.27,
    longitude: 7.41,
  },
  {
    id: 'botyre',
    name: 'Botyre',
    type: 'village',
    parentCommune: 'Ayent',
    latitude: 46.26,
    longitude: 7.4,
  },
  {
    id: 'anzere',
    name: 'Anzère',
    type: 'village',
    parentCommune: 'Ayent',
    latitude: 46.2833,
    longitude: 7.3833,
  },
  {
    id: 'chateauneuf',
    name: 'Châteauneuf',
    type: 'village',
    parentCommune: 'Conthey',
    latitude: 46.23,
    longitude: 7.32,
  },
  {
    id: 'erde',
    name: 'Erde',
    type: 'village',
    parentCommune: 'Conthey',
    latitude: 46.22,
    longitude: 7.34,
  },
  {
    id: 'ovronnaz',
    name: 'Ovronnaz',
    type: 'village',
    parentCommune: 'Leytron',
    latitude: 46.2,
    longitude: 7.17,
  },
  {
    id: 'produit',
    name: 'Produit',
    type: 'village',
    parentCommune: 'Leytron',
    latitude: 46.19,
    longitude: 7.19,
  },
  {
    id: 'mayens-de-chamoson',
    name: 'Mayens de Chamoson',
    type: 'village',
    parentCommune: 'Chamoson',
    latitude: 46.21,
    longitude: 7.19,
  },
  {
    id: 'isérables',
    name: 'Isérables',
    type: 'village',
    parentCommune: 'Riddes',
    latitude: 46.1667,
    longitude: 7.2333,
  },
  {
    id: 'aproz',
    name: 'Aproz',
    type: 'village',
    parentCommune: 'Nendaz',
    latitude: 46.19,
    longitude: 7.3,
  },
  {
    id: 'haute-nendaz',
    name: 'Haute-Nendaz',
    type: 'village',
    parentCommune: 'Nendaz',
    latitude: 46.1833,
    longitude: 7.2833,
  },
  {
    id: 'verbier',
    name: 'Verbier',
    type: 'village',
    parentCommune: 'Bagnes',
    latitude: 46.0967,
    longitude: 7.2281,
  },
  {
    id: 'bagnes',
    name: 'Bagnes',
    type: 'commune',
    parentCommune: null,
    latitude: 46.0833,
    longitude: 7.2167,
  },
  {
    id: 'le-chable',
    name: 'Le Châble',
    type: 'village',
    parentCommune: 'Bagnes',
    latitude: 46.0833,
    longitude: 7.2167,
  },
  {
    id: 'champex',
    name: 'Champex',
    type: 'village',
    parentCommune: 'Orsières',
    latitude: 46.0283,
    longitude: 7.1175,
    searchTerms: ['Champex-Lac'],
  },
  {
    id: 'la-fouly',
    name: 'La Fouly',
    type: 'village',
    parentCommune: 'Orsières',
    latitude: 45.9333,
    longitude: 7.1,
  },
  {
    id: 'troistorrents',
    name: 'Troistorrents',
    type: 'commune',
    parentCommune: null,
    latitude: 46.2333,
    longitude: 6.9167,
  },
  {
    id: 'val-dilliez',
    name: "Val-d'Illiez",
    type: 'commune',
    parentCommune: null,
    latitude: 46.2167,
    longitude: 6.8833,
  },
  {
    id: 'champery',
    name: 'Champéry',
    type: 'village',
    parentCommune: "Val-d'Illiez",
    latitude: 46.1744,
    longitude: 6.8692,
  },
  {
    id: 'leukerbad',
    name: 'Leukerbad',
    type: 'village',
    parentCommune: 'Leuk',
    latitude: 46.3833,
    longitude: 7.6333,
    searchTerms: ['Loèche-les-Bains'],
  },
  {
    id: 'susten',
    name: 'Susten',
    type: 'village',
    parentCommune: 'Leuk',
    latitude: 46.31,
    longitude: 7.62,
  },
  {
    id: 'agarn',
    name: 'Agarn',
    type: 'village',
    parentCommune: 'Leuk',
    latitude: 46.3,
    longitude: 7.65,
  },
];

/**
 * Get a location by its ID (slug)
 */
export function getLocationById(id: string): ValaisLocation | undefined {
  return VALAIS_LOCATIONS.find((loc) => loc.id === id);
}

/**
 * Search locations by text (name or search terms)
 * Returns matching locations sorted by relevance
 */
export function searchLocations(
  query: string,
  limit: number = 8
): ValaisLocation[] {
  if (!query || query.length < 1) return [];

  const normalizedQuery = query.toLowerCase().trim();

  // Score each location based on how well it matches
  const scored = VALAIS_LOCATIONS.map((location) => {
    const nameLower = location.name.toLowerCase();
    const searchTermsLower =
      location.searchTerms?.map((t) => t.toLowerCase()) || [];

    let score = 0;

    // Exact match gets highest score
    if (nameLower === normalizedQuery) {
      score = 100;
    }
    // Starts with query is very good
    else if (nameLower.startsWith(normalizedQuery)) {
      score = 80;
    }
    // Contains query is good
    else if (nameLower.includes(normalizedQuery)) {
      score = 60;
    }
    // Search terms exact match
    else if (searchTermsLower.some((term) => term === normalizedQuery)) {
      score = 90;
    }
    // Search terms starts with
    else if (
      searchTermsLower.some((term) => term.startsWith(normalizedQuery))
    ) {
      score = 70;
    }
    // Search terms contains
    else if (searchTermsLower.some((term) => term.includes(normalizedQuery))) {
      score = 50;
    }

    // Boost cities and communes over villages
    if (score > 0) {
      if (location.type === 'city') score += 5;
      if (location.type === 'commune') score += 3;
    }

    return { location, score };
  });

  // Filter, sort, and limit
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.location);
}

/**
 * Get location display name with parent commune if applicable
 */
export function getLocationDisplayName(location: ValaisLocation): string {
  if (location.parentCommune) {
    return `${location.name}, ${location.parentCommune}`;
  }
  return location.name;
}

/**
 * Get all locations sorted by name
 */
export function getAllLocationsSorted(): ValaisLocation[] {
  return [...VALAIS_LOCATIONS].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  );
}
