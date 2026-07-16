import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages';
import { TEST_USERS, localizedPath } from '../fixtures/auth.fixture';
import { TEST_EXPERIENCES } from '../fixtures/test-data';

const LOCALES = ['fr', 'de', 'en'] as const;
const DEFAULT_LOCALE = process.env.E2E_LOCALE ?? 'en';

async function loginAs(
  page: Page,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS]
) {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login({ email: user.email, password: user.password });
}

async function expectPageHealthy(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
  await expect(page.locator('body')).not.toContainText('Application error');
}

test.describe('Application regression matrix - public and i18n', () => {
  test('critical public routes render in every supported locale', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      const routes = [
        `/${locale}`,
        `/${locale}/experiences`,
        `/${locale}/experiences/${TEST_EXPERIENCES.wineTasting.slug}`,
        `/${locale}/wineries`,
        `/${locale}/wineries/domaine-du-test`,
        `/${locale}/about`,
        `/${locale}/legal/terms`,
        `/${locale}/legal/privacy`,
        `/${locale}/legal/cancellation`,
      ];

      for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBeLessThan(400);
        await expectPageHealthy(page);
      }
    }
  });

  test('unknown experience renders the localized not-found state', async ({
    page,
  }) => {
    await page.goto(`/${DEFAULT_LOCALE}/experiences/not-a-real-experience`);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });
});

test.describe('Application regression matrix - auth and permissions', () => {
  test('protected dashboards redirect anonymous users to localized login', async ({
    page,
  }) => {
    await page.goto(localizedPath('/dashboard/my-bookings'));

    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('callbackUrl')).toContain(
      '/dashboard/my-bookings'
    );
  });

  test('client, winemaker and admin land on their role entry points', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.clientA);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.context().clearCookies();
    await loginAs(page, TEST_USERS.wineryOwner);
    await expect(page).toHaveURL(/\/dashboard\/bookings/);

    await page.context().clearCookies();
    await loginAs(page, TEST_USERS.admin);
    await expect(page).toHaveURL(/\/admin/);
  });

  test('a client cannot access the admin area', async ({ page }) => {
    await loginAs(page, TEST_USERS.clientA);
    await page.goto(localizedPath('/admin'));

    await expect(
      page.getByRole('heading', { name: /admin/i })
    ).not.toBeVisible();
  });
});

test.describe('Application regression matrix - client journey', () => {
  test('client dashboard shows only the signed-in client bookings', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.clientA);
    await page.goto(localizedPath('/dashboard/my-bookings'));

    await expect(page.getByText('ENC-E2E002')).toBeVisible();
    await expect(page.getByText('ENC-E2E003')).not.toBeVisible();
  });

  test('token booking detail exposes the booking reference and status', async ({
    page,
  }) => {
    await page.goto(
      localizedPath(
        '/booking/test-booking-client-a-upcoming?token=token-client-a-upcoming'
      )
    );

    await expect(page.getByText('ENC-E2E001')).toBeVisible();
    await expect(page.getByText(/CONFIRMED/i)).toBeVisible();
  });
});

test.describe('Application regression matrix - winemaker journey', () => {
  test('verified winemaker can access operational dashboards', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.wineryOwner);

    for (const route of [
      '/dashboard/bookings',
      '/dashboard/experiences',
      '/dashboard/earnings',
      '/dashboard/winery/profile',
    ]) {
      const response = await page.goto(localizedPath(route));
      expect(response?.status(), route).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).not.toHaveURL(/\/onboarding\/winery/);
      await expectPageHealthy(page);
    }
  });

  test('pending winemaker is blocked from experience management', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.winemakerPending);
    await page.goto(localizedPath('/dashboard/experiences'));

    const body = page.locator('body');
    const isBlocked =
      page.url().includes('/onboarding/winery') ||
      (await body
        .filter({ hasText: /pending|verification|not verified|en attente/i })
        .isVisible()
        .catch(() => false));

    expect(isBlocked).toBe(true);
  });
});

test.describe('Application regression matrix - admin journey', () => {
  test('admin can access overview and pending wineries queue', async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.admin);

    // P-14 (L-152): TOTP is mandatory — a fresh admin is force-redirected
    // to the enrolment before any /admin surface renders.
    await page.goto(localizedPath('/admin'));
    if (page.url().includes('/admin-setup/2fa')) {
      const { AdminVerificationPage } =
        await import('../pages/admin-verification.page');
      await new AdminVerificationPage(page).enrollTotp(
        TEST_USERS.admin.password
      );
    }

    // A same-URL/client-side navigation yields a null response — only a
    // real document response can carry an error status.
    const adminResponse = await page.goto(localizedPath('/admin'));
    expect(adminResponse?.status() ?? 200).toBeLessThan(400);
    await expectPageHealthy(page);

    const pendingResponse = await page.goto(
      localizedPath('/admin/wineries/pending')
    );
    expect(pendingResponse?.status() ?? 200).toBeLessThan(400);
    await expect(
      page.getByText('E2E Vigneron En Attente Winery')
    ).toBeVisible();
  });
});
