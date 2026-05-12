import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Header } from '@/components/layout/Header';

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => {
      const translations: Record<string, string> = {
        goToHomepage: 'EnCave - Go to homepage',
        mainNavigation: 'Main navigation',
        wineries: 'Wineries',
        experiences: 'Experiences',
        admin: 'Admin',
        dashboard: 'Dashboard',
        signIn: 'Sign in',
        getStarted: 'Get started',
      };
      return translations[key] || key;
    })
  ),
}));

// Mock auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock LocaleSwitcher component (uses next-intl)
vi.mock('@/components/shared/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher">FR | DE | EN</div>,
}));

// Mock NavLink component
vi.mock('@/components/layout/NavLink', () => ({
  NavLink: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-testid={`navlink-${href.replace(/\//g, '-')}`}>
      {children}
    </a>
  ),
}));

// Mock UserMenu component
vi.mock('@/components/features/auth/UserMenu', () => ({
  UserMenu: ({ userName }: { userName: string | null | undefined }) => (
    <div data-testid="user-menu">{userName}</div>
  ),
}));

import { auth } from '@/server/auth';

describe('Header', () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the EnCave logo with link to homepage', async () => {
    const HeaderComponent = await Header();
    render(HeaderComponent);

    const logoLink = screen.getByRole('link', {
      name: /encave.*go to homepage/i,
    });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders Wineries navigation link', async () => {
    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.getByTestId('navlink--wineries')).toHaveTextContent(
      'Wineries'
    );
  });

  it('renders Experiences navigation link', async () => {
    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.getByTestId('navlink--experiences')).toHaveTextContent(
      'Experiences'
    );
  });

  it('renders sign in and get started buttons when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /get started/i })
    ).toBeInTheDocument();
  });

  it('renders user menu when authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@test.com',
        role: 'CLIENT',
      },
      expires: new Date().toISOString(),
    });

    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /sign in/i })
    ).not.toBeInTheDocument();
  });

  it('renders Admin link for ADMIN users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: '1',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'ADMIN',
      },
      expires: new Date().toISOString(),
    });

    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.getByTestId('navlink--admin')).toHaveTextContent('Admin');
  });

  it('renders Dashboard link for WINEMAKER users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: '1',
        name: 'Winemaker',
        email: 'winemaker@test.com',
        role: 'WINEMAKER',
      },
      expires: new Date().toISOString(),
    });

    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.getByTestId('navlink--dashboard')).toHaveTextContent(
      'Dashboard'
    );
  });

  it('does not render Admin link for non-admin users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: '1', name: 'User', email: 'user@test.com', role: 'CLIENT' },
      expires: new Date().toISOString(),
    });

    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.queryByTestId('navlink--admin')).not.toBeInTheDocument();
  });

  it('does not render Dashboard link for non-winemaker users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: '1', name: 'User', email: 'user@test.com', role: 'CLIENT' },
      expires: new Date().toISOString(),
    });

    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(screen.queryByTestId('navlink--dashboard')).not.toBeInTheDocument();
  });
});
