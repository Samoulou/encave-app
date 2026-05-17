import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NavLink } from '@/components/layout/NavLink';

vi.mock('@/i18n/navigation', async () => ({
  ...(await vi.importActual('@/i18n/navigation')),
  usePathname: vi.fn(),
}));

import { usePathname } from '@/i18n/navigation';

describe('NavLink', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders link with correct href and text', () => {
    vi.mocked(usePathname).mockReturnValue('/');

    render(<NavLink href="/experiences">Experiences</NavLink>);

    const link = screen.getByRole('link', { name: 'Experiences' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/experiences');
  });

  it('applies active styling when on exact route', () => {
    vi.mocked(usePathname).mockReturnValue('/experiences');

    render(<NavLink href="/experiences">Experiences</NavLink>);

    const link = screen.getByRole('link', { name: 'Experiences' });
    expect(link).toHaveClass('text-burgundy-700');
  });

  it('applies active styling when on child route', () => {
    vi.mocked(usePathname).mockReturnValue('/experiences/wine-tasting');

    render(<NavLink href="/experiences">Experiences</NavLink>);

    const link = screen.getByRole('link', { name: 'Experiences' });
    expect(link).toHaveClass('text-burgundy-700');
  });

  it('applies inactive styling when on different route', () => {
    vi.mocked(usePathname).mockReturnValue('/wineries');

    render(<NavLink href="/experiences">Experiences</NavLink>);

    const link = screen.getByRole('link', { name: 'Experiences' });
    expect(link).toHaveClass('text-slate-600');
    expect(link).not.toHaveClass('text-burgundy-700');
  });

  it('applies custom className', () => {
    vi.mocked(usePathname).mockReturnValue('/');

    render(
      <NavLink href="/test" className="custom-class">
        Test
      </NavLink>
    );

    const link = screen.getByRole('link', { name: 'Test' });
    expect(link).toHaveClass('custom-class');
  });
});
