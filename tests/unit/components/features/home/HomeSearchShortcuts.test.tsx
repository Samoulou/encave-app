import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { HomeSearchShortcuts } from '@/components/features/home/HomeSearchShortcuts';

describe('HomeSearchShortcuts', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // The global next-intl mock returns the bare key (namespace stripped).
  it('renders the three shortcut chips', () => {
    render(<HomeSearchShortcuts />);
    expect(screen.getByText('thisWeekend')).toBeDefined();
    expect(screen.getByText('tastings')).toBeDefined();
    expect(screen.getByText('withMeal')).toBeDefined();
  });

  it('links the type chips to the pre-filtered catalogue', () => {
    render(<HomeSearchShortcuts />);
    expect(
      screen.getByText('tastings').closest('a')?.getAttribute('href')
    ).toBe('/experiences?type=TASTING');
    expect(
      screen.getByText('withMeal').closest('a')?.getAttribute('href')
    ).toBe('/experiences?type=MEAL');
  });

  it('links the weekend chip to a quand/quand_fin range after mount', async () => {
    // Thursday 2026-07-09 → weekend = 11/12 July.
    vi.useFakeTimers({ now: new Date(2026, 6, 9, 12, 0), toFake: ['Date'] });
    render(<HomeSearchShortcuts />);
    vi.useRealTimers();

    await waitFor(() => {
      expect(
        screen.getByText('thisWeekend').closest('a')?.getAttribute('href')
      ).toBe('/experiences?quand=2026-07-11&quand_fin=2026-07-12');
    });
  });
});
