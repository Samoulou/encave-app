import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';

// Mock usePathname hook
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from 'next/navigation';

describe('DashboardSidebar', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');
  });

  afterEach(() => {
    cleanup();
  });

  it('displays winery name at top', () => {
    render(<DashboardSidebar wineryName="Test Winery" />);

    expect(screen.getByText('Test Winery')).toBeInTheDocument();
    expect(screen.getByText('Your Winery')).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    render(<DashboardSidebar wineryName="Test Winery" />);

    expect(screen.getByRole('link', { name: /experiences/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /winery profile/i })).toBeInTheDocument();
  });

  it('renders navigation links with correct hrefs', () => {
    render(<DashboardSidebar wineryName="Test Winery" />);

    expect(screen.getByRole('link', { name: /experiences/i })).toHaveAttribute(
      'href',
      '/dashboard/experiences'
    );
    expect(screen.getByRole('link', { name: /winery profile/i })).toHaveAttribute(
      'href',
      '/dashboard/winery/profile'
    );
  });

  it('shows active state for current route', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard/experiences');

    render(<DashboardSidebar wineryName="Test Winery" />);

    const experiencesLink = screen.getByRole('link', { name: /experiences/i });
    expect(experiencesLink).toHaveAttribute('aria-current', 'page');
    expect(experiencesLink).toHaveClass('bg-burgundy-50');
  });

  it('shows active state for nested route', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard/experiences/new');

    render(<DashboardSidebar wineryName="Test Winery" />);

    const experiencesLink = screen.getByRole('link', { name: /experiences/i });
    expect(experiencesLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders mobile menu toggle button', () => {
    render(<DashboardSidebar wineryName="Test Winery" />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('toggles mobile menu visibility', () => {
    render(<DashboardSidebar wineryName="Test Winery" />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });

    // Initially closed (hidden on mobile via translate)
    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('-translate-x-full');

    // Open menu
    fireEvent.click(menuButton);
    expect(sidebar).toHaveClass('translate-x-0');

    // Close menu button should now be visible
    const closeButton = screen.getByRole('button', { name: /close menu/i });
    fireEvent.click(closeButton);
    expect(sidebar).toHaveClass('-translate-x-full');
  });

  it('has proper accessibility attributes', () => {
    render(<DashboardSidebar wineryName="Test Winery" />);

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /dashboard navigation/i })).toBeInTheDocument();
  });
});
