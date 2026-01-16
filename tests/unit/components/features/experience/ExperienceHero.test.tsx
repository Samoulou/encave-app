import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExperienceHero } from '@/components/features/experience/ExperienceHero';

describe('ExperienceHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders experience title', () => {
    render(
      <ExperienceHero
        title="Wine Tasting Experience"
        type="TASTING"
        price={5000}
        coverPhoto="https://example.com/photo.jpg"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Wine Tasting Experience' })
    ).toBeDefined();
  });

  it('renders type badge with correct label', () => {
    render(
      <ExperienceHero
        title="Test Experience"
        type="CELLAR_VISIT"
        price={5000}
        coverPhoto="https://example.com/photo.jpg"
      />
    );

    expect(screen.getByText('Cellar Visit')).toBeDefined();
  });

  it('formats price correctly in CHF', () => {
    render(
      <ExperienceHero
        title="Test Experience"
        type="TASTING"
        price={7500}
        coverPhoto="https://example.com/photo.jpg"
      />
    );

    expect(screen.getByText('CHF 75.00')).toBeDefined();
  });

  it('renders per person text', () => {
    render(
      <ExperienceHero
        title="Test Experience"
        type="TASTING"
        price={5000}
        coverPhoto="https://example.com/photo.jpg"
      />
    );

    expect(screen.getByText('per person')).toBeDefined();
  });

  it('renders image when coverPhoto is provided', () => {
    render(
      <ExperienceHero
        title="Test Experience"
        type="TASTING"
        price={5000}
        coverPhoto="https://example.com/photo.jpg"
      />
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('alt')).toBe('Test Experience');
  });

  it('renders all type labels correctly', () => {
    const types = [
      { type: 'TASTING' as const, label: 'Wine Tasting' },
      { type: 'CELLAR_VISIT' as const, label: 'Cellar Visit' },
      { type: 'WORKSHOP' as const, label: 'Workshop' },
      { type: 'VINEYARD_TOUR' as const, label: 'Vineyard Tour' },
      { type: 'FOOD_PAIRING' as const, label: 'Food Pairing' },
    ];

    for (const { type, label } of types) {
      cleanup();
      render(
        <ExperienceHero
          title="Test"
          type={type}
          price={5000}
          coverPhoto="https://example.com/photo.jpg"
        />
      );
      expect(screen.getByText(label)).toBeDefined();
    }
  });
});
