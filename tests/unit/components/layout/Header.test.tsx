import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { HeaderAuthSlot } from '@/components/layout/HeaderAuthSlot';
import { HeaderRoleLink } from '@/components/layout/HeaderRoleLink';

// Mock next-intl (client islands) and next-intl/server (Header)
const NAV_TRANSLATIONS: Record<string, string> = {
  goToHomepage: 'EnCave - Go to homepage',
  mainNavigation: 'Main navigation',
  wineries: 'Wineries',
  experiences: 'Experiences',
  about: 'About',
  admin: 'Admin',
  dashboard: 'Dashboard',
  myBookings: 'My bookings',
  signIn: 'Sign in',
  getStarted: 'Get started',
};

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => NAV_TRANSLATIONS[key] || key)
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => NAV_TRANSLATIONS[key] || key,
}));

// The session now resolves in a CLIENT island — mock the client hook.
vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/components/shared/LocaleCurrencyChip', () => ({
  LocaleCurrencyChip: () => <div data-testid="locale-chip">FR · CHF</div>,
}));

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

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

vi.mock('@/components/features/auth/UserMenu', () => ({
  UserMenu: ({ userName }: { userName: string | null | undefined }) => (
    <div data-testid="user-menu">{userName}</div>
  ),
}));

import { useSession } from '@/lib/auth-client';

function mockSession(
  state:
    | { kind: 'pending' }
    | { kind: 'anonymous' }
    | { kind: 'user'; name: string; role: string }
) {
  vi.mocked(useSession).mockReturnValue(
    (state.kind === 'pending'
      ? { data: null, isPending: true }
      : state.kind === 'anonymous'
        ? { data: null, isPending: false }
        : {
            data: {
              user: {
                id: '1',
                name: state.name,
                email: 'u@test.ch',
                role: state.role,
              },
            },
            isPending: false,
          }) as never
  );
}

describe('Header (static server component — P-06)', () => {
  beforeEach(() => {
    mockSession({ kind: 'anonymous' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders logo and static nav links without any server session call', async () => {
    const HeaderComponent = await Header();
    render(HeaderComponent);

    expect(
      screen.getByRole('link', { name: /encave.*go to homepage/i })
    ).toHaveAttribute('href', '/');
    expect(screen.getByTestId('navlink--experiences')).toHaveTextContent(
      'Experiences'
    );
    expect(screen.getByTestId('navlink--wineries')).toHaveTextContent(
      'Wineries'
    );
  });
});

describe('HeaderAuthSlot (client island)', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a neutral skeleton while the session is pending — never the sign-in buttons', () => {
    mockSession({ kind: 'pending' });
    render(<HeaderAuthSlot />);

    expect(screen.getByTestId('header-auth-skeleton')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /sign in/i })
    ).not.toBeInTheDocument();
  });

  it('shows sign in / get started for anonymous visitors', () => {
    mockSession({ kind: 'anonymous' });
    render(<HeaderAuthSlot />);

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /get started/i })
    ).toBeInTheDocument();
  });

  it('shows the user menu once the session resolves', () => {
    mockSession({ kind: 'user', name: 'Test User', role: 'CLIENT' });
    render(<HeaderAuthSlot />);

    expect(screen.getByTestId('user-menu')).toHaveTextContent('Test User');
    expect(
      screen.queryByRole('link', { name: /sign in/i })
    ).not.toBeInTheDocument();
  });
});

describe('HeaderRoleLink (client island)', () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ['ADMIN', '-admin', 'Admin'],
    ['WINEMAKER', '-dashboard', 'Dashboard'],
    ['CLIENT', '-dashboard-my-bookings', 'My bookings'],
  ])('renders the %s link', (role, testId, label) => {
    mockSession({ kind: 'user', name: 'U', role });
    render(<HeaderRoleLink />);

    expect(screen.getByTestId(`navlink-${testId}`)).toHaveTextContent(label);
  });

  it('renders nothing while pending or anonymous', () => {
    mockSession({ kind: 'pending' });
    const { container } = render(<HeaderRoleLink />);
    expect(container).toBeEmptyDOMElement();

    cleanup();
    mockSession({ kind: 'anonymous' });
    const { container: anon } = render(<HeaderRoleLink />);
    expect(anon).toBeEmptyDOMElement();
  });
});
