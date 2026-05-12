import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WineryCard } from '@/components/features/winery/WineryCard';

const mockWinery = {
  slug: 'domaine-test',
  name: 'Domaine Test',
  commune: 'Sion',
  description:
    'A beautiful winery in the heart of Valais producing exceptional wines.',
  coverPhoto: 'https://example.com/photo.jpg',
};

describe('WineryCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders winery name', () => {
    render(<WineryCard winery={mockWinery} />);

    expect(screen.getByRole('heading', { name: 'Domaine Test' })).toBeDefined();
  });

  it('renders commune with Valais suffix', () => {
    render(<WineryCard winery={mockWinery} />);

    expect(screen.getByText(/Sion, Valais/)).toBeDefined();
  });

  it('renders description', () => {
    render(<WineryCard winery={mockWinery} />);

    expect(screen.getByText(/beautiful winery/)).toBeDefined();
  });

  it('links to correct winery detail page', () => {
    render(<WineryCard winery={mockWinery} />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/wineries/domaine-test');
  });

  it('renders image when coverPhoto is provided', () => {
    render(<WineryCard winery={mockWinery} />);

    const img = screen.getByRole('img');
    expect(img.getAttribute('alt')).toBe('Domaine Test');
  });

  it('renders placeholder when coverPhoto is null', () => {
    const wineryNoCover = { ...mockWinery, coverPhoto: null };
    render(<WineryCard winery={wineryNoCover} />);

    // Should not have an img element
    const img = screen.queryByRole('img');
    expect(img).toBeNull();
  });

  it('applies line-clamp-2 class for description truncation', () => {
    render(<WineryCard winery={mockWinery} />);

    const description = screen.getByText(/beautiful winery/);
    expect(description.className).toContain('line-clamp-2');
  });

  it('handles long descriptions gracefully', () => {
    const longDescription = 'A'.repeat(500);
    const wineryLongDesc = { ...mockWinery, description: longDescription };
    render(<WineryCard winery={wineryLongDesc} />);

    const description = screen.getByText(/AAAA/);
    expect(description).toBeDefined();
    expect(description.className).toContain('line-clamp-2');
  });
});
