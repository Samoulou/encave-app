import {
  searchExperiences,
  getExperienceCommunes,
  type SearchParams,
} from '@/server/queries/experience.queries';
import { ExperiencesPageClient } from './ExperiencesPageClient';
import { JsonLd } from '@/components/shared/JsonLd';
import { getBaseUrl } from '@/lib/env';

interface ExperiencesContentProps {
  searchParams: SearchParams;
}

/**
 * Async server component that fetches experience data.
 * Designed to be wrapped in Suspense for streaming/progressive loading.
 */
export async function ExperiencesContent({ searchParams }: ExperiencesContentProps) {
  // Fetch data in parallel - this is the slow part
  const [searchResult, communes] = await Promise.all([
    searchExperiences(searchParams),
    getExperienceCommunes(),
  ]);

  const baseUrl = getBaseUrl();

  // SEO-004: ItemList schema for experiences listing
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Wine Experiences in Valais',
    description: 'Discover wine tastings, cellar visits, and vineyard tours in Valais, Switzerland',
    url: `${baseUrl}/experiences`,
    numberOfItems: searchResult.total,
    itemListElement: searchResult.experiences.map((exp, index) => ({
      '@type': 'ListItem',
      position: (searchResult.page - 1) * searchResult.limit + index + 1,
      item: {
        '@type': 'Event',
        '@id': `${baseUrl}/experiences/${exp.slug}`,
        name: exp.title,
        description: exp.description,
        image: exp.coverPhoto,
        url: `${baseUrl}/experiences/${exp.slug}`,
        offers: {
          '@type': 'Offer',
          price: exp.price / 100,
          priceCurrency: 'CHF',
          availability: 'https://schema.org/InStock',
        },
        location: {
          '@type': 'Place',
          name: exp.winery.name,
          address: {
            '@type': 'PostalAddress',
            addressLocality: exp.winery.commune,
            addressRegion: 'Valais',
            addressCountry: 'CH',
          },
        },
      },
    })),
  };

  return (
    <>
      <JsonLd data={itemListSchema} />
      <ExperiencesPageClient
        initialExperiences={searchResult.experiences}
        communes={communes}
        pagination={{
          total: searchResult.total,
          page: searchResult.page,
          limit: searchResult.limit,
          totalPages: searchResult.totalPages,
        }}
        locationSearch={{
          hasLocationSearch: searchResult.hasLocationSearch,
          locationName: searchResult.locationName,
        }}
      />
    </>
  );
}
