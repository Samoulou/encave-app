import { test as base, Page } from '@playwright/test';

const E2E_LOCALE = process.env.E2E_LOCALE ?? 'en';

export function localizedPath(path: string, locale = E2E_LOCALE): string {
  if (/^\/(fr|de|en)(\/|$)/.test(path)) {
    return path;
  }

  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Authentication fixtures for E2E tests
 *
 * This fixture provides pre-authenticated page contexts for tests
 * that require logged-in users.
 *
 * Note: For guest booking flow tests, authentication is typically NOT required
 * as the booking flow is public. These fixtures are useful for:
 * - Winery owner dashboard tests
 * - Admin panel tests
 * - Authenticated user profile tests
 */

// ============================================================
// TYPES
// ============================================================

/**
 * Test user credentials
 */
export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: 'guest' | 'winery_owner' | 'admin';
}

/**
 * Extended test fixtures
 */
export interface AuthFixtures {
  /** Page with authenticated guest user session */
  authenticatedGuestPage: Page;
  /** Page with authenticated winery owner session */
  authenticatedWineryPage: Page;
  /** Page with authenticated admin session */
  authenticatedAdminPage: Page;
}

// ============================================================
// TEST USERS
// ============================================================

/**
 * Pre-defined test users
 * These should match users seeded in the test database
 */
export const TEST_USERS: Record<string, TestUser> = {
  guest: {
    email: 'guest@test.example.com',
    password: 'TestPassword123!',
    name: 'Test Guest',
    role: 'guest',
  },
  wineryOwner: {
    email: 'winery@test.example.com',
    password: 'TestPassword123!',
    name: 'Test Winery Owner',
    role: 'winery_owner',
  },
  admin: {
    email: 'admin@test.example.com',
    password: 'AdminPassword123!',
    name: 'Test Admin',
    role: 'admin',
  },
  clientA: {
    email: 'client-a@test.encave.ch',
    password: 'TestPassword123!',
    name: 'Client Alpha',
    role: 'guest',
  },
  clientB: {
    email: 'client-b@test.encave.ch',
    password: 'TestPassword123!',
    name: 'Client Beta',
    role: 'guest',
  },
  winemakerVerified: {
    email: 'winemaker-verified@test.encave.ch',
    password: 'TestPassword123!',
    name: 'Vigneron Verifie',
    role: 'winery_owner',
  },
  winemakerPending: {
    email: 'winemaker-pending@test.encave.ch',
    password: 'TestPassword123!',
    name: 'Vigneron En Attente',
    role: 'winery_owner',
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Perform login on a page
 */
async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto(localizedPath('/login'));

  // Fill login form
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);

  // Submit
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for redirect (dashboard or home)
  await page.waitForURL(
    /\/(dashboard|my-bookings|bookings|admin|home|en|fr|de)/
  );
}

/**
 * Check if page is authenticated
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for auth indicators - adjust based on your app's auth state
  const logoutButton = page.getByRole('button', { name: /sign out|log out/i });
  const userMenu = page.getByTestId('user-menu');

  return (await logoutButton.isVisible()) || (await userMenu.isVisible());
}

/**
 * Logout from current session
 */
async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByRole('button', { name: /sign out|log out/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL('/login');
  }
}

// ============================================================
// FIXTURES
// ============================================================

/**
 * Extended test with authentication fixtures
 *
 * Usage:
 * ```typescript
 * import { test } from '../fixtures/auth.fixture';
 *
 * test('winery owner can view dashboard', async ({ authenticatedWineryPage }) => {
 *   await authenticatedWineryPage.goto('/dashboard');
 *   // ...test continues with authenticated session
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Page with authenticated guest user
   */
  authenticatedGuestPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.guest);
    await use(page);
  },

  /**
   * Page with authenticated winery owner
   */
  authenticatedWineryPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.wineryOwner);
    await use(page);
  },

  /**
   * Page with authenticated admin
   */
  authenticatedAdminPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.admin);
    await use(page);
  },
});

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';

// ============================================================
// STORAGE STATE (Alternative Approach)
// ============================================================

/**
 * Save authenticated storage state to file
 * Can be used for faster test setup by reusing sessions
 *
 * Usage:
 * 1. Run a setup script that logs in and saves state
 * 2. Tests can then use `storageState` in their config
 *
 * @example
 * // In global-setup.ts
 * const browser = await chromium.launch();
 * const page = await browser.newPage();
 * await saveAuthState(page, TEST_USERS.wineryOwner, './auth/winery.json');
 */
export async function saveAuthState(
  page: Page,
  user: TestUser,
  outputPath: string
): Promise<void> {
  await loginUser(page, user);
  await page.context().storageState({ path: outputPath });
}

/**
 * Storage state paths
 */
export const AUTH_STATE_PATHS = {
  guest: './tests/e2e/.auth/guest.json',
  wineryOwner: './tests/e2e/.auth/winery-owner.json',
  admin: './tests/e2e/.auth/admin.json',
};
