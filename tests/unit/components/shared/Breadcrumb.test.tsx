import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Breadcrumb } from '@/components/shared/Breadcrumb';

describe('Breadcrumb', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all breadcrumb items', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Experiences', href: '/experiences' },
          { label: 'Wine Tasting' },
        ]}
      />
    );

    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Experiences')).toBeDefined();
    expect(screen.getByText('Wine Tasting')).toBeDefined();
  });

  it('renders links for items with href', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Experiences', href: '/experiences' },
          { label: 'Wine Tasting' },
        ]}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('/');
    expect(links[1]?.getAttribute('href')).toBe('/experiences');
  });

  it('does not render link for last item', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }, { label: 'Current Page' }]}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(screen.getByText('Current Page')).toBeDefined();
  });

  it('has aria-label for navigation', () => {
    render(
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Page' }]} />
    );

    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' })
    ).toBeDefined();
  });

  it('marks last item as current page', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }, { label: 'Current Page' }]}
      />
    );

    // The aria-current is on the wrapper span, not the text span
    const textElement = screen.getByText('Current Page');
    const wrapperSpan = textElement.closest('span[aria-current]');
    expect(wrapperSpan?.getAttribute('aria-current')).toBe('page');
  });
});
