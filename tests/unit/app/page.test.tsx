import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock next-intl
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

// Mock the Header component
vi.mock('@/components/layout/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

// Mock the HealthStatus component
vi.mock('@/components/shared/HealthStatus', () => ({
  HealthStatus: () => <div data-testid="health-status">HealthStatus</div>,
}));

// Import after mocks
import Home from '@/app/[locale]/page';

describe('Homepage', () => {
  afterEach(() => {
    cleanup();
  });

  // Helper to render the async component
  const renderHome = async () => {
    const Component = await Home({ params: Promise.resolve({ locale: 'en' }) });
    render(Component);
  };

  it('renders hero section with title', async () => {
    await renderHome();

    expect(
      screen.getByRole('heading', { name: /discover valais wine experiences/i })
    ).toBeInTheDocument();
  });

  it('renders discovery section with experiences CTA', async () => {
    await renderHome();

    const experiencesCard = screen.getByRole('heading', { name: /^wine experiences$/i, level: 3 });
    expect(experiencesCard).toBeInTheDocument();

    const experiencesLink = screen.getByRole('link', { name: /browse experiences/i });
    expect(experiencesLink).toHaveAttribute('href', '/experiences');
  });

  it('renders discovery section with wineries CTA', async () => {
    await renderHome();

    const wineriesCard = screen.getByRole('heading', { name: /our wineries/i });
    expect(wineriesCard).toBeInTheDocument();

    const wineriesLink = screen.getByRole('link', { name: /meet our winemakers/i });
    expect(wineriesLink).toHaveAttribute('href', '/wineries');
  });

  it('renders CTA buttons section', async () => {
    await renderHome();

    expect(
      screen.getByRole('heading', { name: /ready to explore/i })
    ).toBeInTheDocument();

    const viewExperiencesButton = screen.getByRole('link', { name: /view all experiences/i });
    expect(viewExperiencesButton).toHaveAttribute('href', '/experiences');

    const becomePartnerButton = screen.getByRole('link', { name: /become a partner/i });
    expect(becomePartnerButton).toHaveAttribute('href', '/register/winemaker');
  });

  it('includes header component', async () => {
    await renderHome();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('includes health status component', async () => {
    await renderHome();
    expect(screen.getByTestId('health-status')).toBeInTheDocument();
  });

  it('has proper accessibility structure', async () => {
    await renderHome();

    // Main content area
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');

    // Discovery section has proper labeling
    const discoverSection = screen.getByRole('region', { name: /discover/i });
    expect(discoverSection).toBeInTheDocument();
  });
});
