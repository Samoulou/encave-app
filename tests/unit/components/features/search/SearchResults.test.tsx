import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SearchResults } from '@/components/features/search/SearchResults';
import type { ExperienceSearchResult } from '@/server/queries/experience.queries';

const mockExperiences: ExperienceSearchResult[] = [
  {
    id: 'exp-1',
    title: 'Wine Tasting Experience',
    slug: 'wine-tasting-experience',
    description: 'A great tasting',
    type: 'TASTING',
    duration: 120,
    price: 5000,
    maxCapacity: 10,
    coverPhoto: 'https://example.com/photo1.jpg',
    createdAt: new Date('2024-01-01'),
    winery: {
      id: 'winery-1',
      name: 'Domaine des Vins',
      slug: 'domaine-des-vins',
      commune: 'Sion',
    },
  },
  {
    id: 'exp-2',
    title: 'Cellar Visit Tour',
    slug: 'cellar-visit-tour',
    description: 'Explore our cellar',
    type: 'CELLAR_VISIT',
    duration: 90,
    price: 3500,
    maxCapacity: 8,
    coverPhoto: 'https://example.com/photo2.jpg',
    createdAt: new Date('2024-01-02'),
    winery: {
      id: 'winery-2',
      name: 'Cave du Valais',
      slug: 'cave-du-valais',
      commune: 'Sierre',
    },
  },
];

describe('SearchResults', () => {
  afterEach(() => {
    cleanup();
  });

  it('displays result count with correct pluralization', () => {
    render(
      <SearchResults
        experiences={mockExperiences}
        sort="relevance"
        onSortChange={vi.fn()}
      />
    );
    // Check for "2 experiences found" text pattern
    expect(screen.getByText(/experiences found/)).toBeDefined();
    // Find the span with just "2" which has the font-medium class
    const countSpan = screen.getByText('2', { selector: 'span.font-medium' });
    expect(countSpan).toBeDefined();
  });

  it('displays singular form for one result', () => {
    render(
      <SearchResults
        experiences={[mockExperiences[0]!]}
        sort="relevance"
        onSortChange={vi.fn()}
      />
    );
    // Check for "1 experience found" text pattern
    expect(screen.getByText(/experience found/)).toBeDefined();
    const countSpan = screen.getByText('1', { selector: 'span.font-medium' });
    expect(countSpan).toBeDefined();
  });

  it('renders experience cards', () => {
    render(
      <SearchResults
        experiences={mockExperiences}
        sort="relevance"
        onSortChange={vi.fn()}
      />
    );
    expect(screen.getByText('Wine Tasting Experience')).toBeDefined();
    expect(screen.getByText('Cellar Visit Tour')).toBeDefined();
  });

  it('renders empty state when no results', () => {
    render(
      <SearchResults experiences={[]} sort="relevance" onSortChange={vi.fn()} />
    );
    expect(screen.getByText('No experiences found')).toBeDefined();
    expect(
      screen.getByText(/No experiences match your filters/)
    ).toBeDefined();
  });

  it('renders sort dropdown with current value', () => {
    render(
      <SearchResults
        experiences={mockExperiences}
        sort="price_asc"
        onSortChange={vi.fn()}
      />
    );
    expect(screen.getByText('Price: Low to High')).toBeDefined();
  });

  it('calls onSortChange when sort is changed', async () => {
    const onSortChange = vi.fn();
    render(
      <SearchResults
        experiences={mockExperiences}
        sort="relevance"
        onSortChange={onSortChange}
      />
    );

    // Open dropdown by clicking trigger
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Select a different option
    const priceOption = screen.getByText('Price: High to Low');
    fireEvent.click(priceOption);

    expect(onSortChange).toHaveBeenCalledWith('price_desc');
  });

  it('displays all sort options', () => {
    render(
      <SearchResults
        experiences={mockExperiences}
        sort="relevance"
        onSortChange={vi.fn()}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Use getAllByText to handle multiple elements with same text
    expect(screen.getAllByText('Relevance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Price: Low to High')).toBeDefined();
    expect(screen.getByText('Price: High to Low')).toBeDefined();
    expect(screen.getByText('Newest First')).toBeDefined();
  });
});
