import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next/image', () => ({
  default: ({ alt = '', ...props }: { alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

// Mock next-intl
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(() =>
    Promise.resolve(
      Object.assign(
        (key: string) => {
          const translations: Record<string, string> = {
            heroTitle: 'Discover Valais Wine Experiences',
            heroSubtitle:
              'Book unique wine tasting experiences directly with Swiss winemakers.',
            heroImageAlt: 'Valais vineyard',
            ctaImageAlt: 'Wine cellar',
            ctaTitle: 'Ready to explore?',
            ctaSubtitle: 'Start your journey through the world of Swiss wines.',
            ctaButton: 'View All Experiences',
            becomePartner: 'Become a Partner',
          };
          return translations[key] || key;
        },
        {
          rich: (key: string) => {
            const translations: Record<string, string> = {
              heroTitle: 'Discover Valais Wine Experiences',
            };
            return translations[key] || key;
          },
        }
      )
    )
  ),
}));

// Mock the Header component
vi.mock('@/components/layout/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

vi.mock('@/components/layout/Footer', () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

// Mock the HealthStatus component
vi.mock('@/components/shared/HealthStatus', () => ({
  HealthStatus: () => <div data-testid="health-status">HealthStatus</div>,
}));

vi.mock('@/components/shared/FadeIn', () => ({
  FadeIn: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/features/home/HeroSearchBar', () => ({
  HeroSearchBar: () => <div data-testid="hero-search">HeroSearchBar</div>,
}));

vi.mock('@/components/features/home/PopularExperiences', () => ({
  PopularExperiences: () => (
    <section aria-label="Popular experiences">Popular experiences</section>
  ),
}));

vi.mock('@/components/features/home/HowItWorks', () => ({
  HowItWorks: () => <section aria-label="How it works">How it works</section>,
}));

vi.mock('@/server/queries/experience.queries', () => ({
  getFeaturedExperiences: vi.fn(() => Promise.resolve([])),
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

  it('renders hero search', async () => {
    await renderHome();

    expect(screen.getByTestId('hero-search')).toBeInTheDocument();
  });

  it('renders homepage content sections', async () => {
    await renderHome();

    expect(
      screen.getByRole('region', { name: /popular experiences/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /how it works/i })
    ).toBeInTheDocument();
  });

  it('renders CTA buttons section', async () => {
    await renderHome();

    expect(
      screen.getByRole('heading', { name: /ready to explore/i })
    ).toBeInTheDocument();

    const viewExperiencesButton = screen.getByRole('link', {
      name: /view all experiences/i,
    });
    expect(viewExperiencesButton).toHaveAttribute('href', '/experiences');

    const becomePartnerButton = screen.getByRole('link', {
      name: /become a partner/i,
    });
    expect(becomePartnerButton).toHaveAttribute(
      'href',
      '/register?winemaker=true'
    );
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

    expect(
      screen.getByRole('region', { name: /popular experiences/i })
    ).toBeInTheDocument();
  });
});
