import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExperienceCard } from '@/components/features/experience/ExperienceCard';

const mockExperience = {
  id: 'exp-1',
  title: 'Wine Tasting Experience',
  slug: 'wine-tasting-experience',
  type: 'TASTING' as const,
  duration: 120,
  price: 5000, // 50 CHF in cents
  maxCapacity: 10,
  coverPhoto: 'https://example.com/photo.jpg',
  winery: {
    name: 'Domaine des Vins',
    slug: 'domaine-des-vins',
    commune: 'Sion',
  },
};

describe('ExperienceCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders experience title', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(
      screen.getByRole('heading', { name: 'Wine Tasting Experience' })
    ).toBeDefined();
  });

  it('renders winery name', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('Domaine des Vins')).toBeDefined();
  });

  it('renders commune location', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('Sion')).toBeDefined();
  });

  it('renders type badge', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('Tasting')).toBeDefined();
  });

  it('formats price correctly in CHF', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('CHF 50.00')).toBeDefined();
  });

  it('formats duration as hours when >= 60 minutes', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('2 hours')).toBeDefined();
  });

  it('formats duration as minutes when < 60', () => {
    const shortExperience = { ...mockExperience, duration: 45 };
    render(<ExperienceCard experience={shortExperience} />);
    expect(screen.getByText('45 min')).toBeDefined();
  });

  it('displays max capacity', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText(/Up to 10/)).toBeDefined();
  });

  it('links to experience detail page', () => {
    render(<ExperienceCard experience={mockExperience} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/experiences/wine-tasting-experience');
  });

  it('renders cover photo image', () => {
    render(<ExperienceCard experience={mockExperience} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('alt')).toBe('Wine Tasting Experience');
  });

  it('renders different type badges correctly', () => {
    const cellarVisit = {
      ...mockExperience,
      type: 'CELLAR_VISIT' as const,
    };
    render(<ExperienceCard experience={cellarVisit} />);
    expect(screen.getByText('Cellar Visit')).toBeDefined();
  });

  it('formats 1 hour duration correctly', () => {
    const oneHourExperience = { ...mockExperience, duration: 60 };
    render(<ExperienceCard experience={oneHourExperience} />);
    expect(screen.getByText('1 hour')).toBeDefined();
  });

  it('formats mixed hours and minutes correctly', () => {
    const mixedDuration = { ...mockExperience, duration: 90 };
    render(<ExperienceCard experience={mixedDuration} />);
    expect(screen.getByText('1h 30min')).toBeDefined();
  });
});
