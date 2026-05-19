import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages';
import { TEST_USERS, localizedPath } from '../fixtures/auth.fixture';
import { TEST_EXPERIENCES } from '../fixtures/test-data';

const LOCALES = ['fr', 'de', 'en'] as const;

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

test.describe('Application regression matrix', () => {
  test('critical public routes render in every supported locale', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      const routes = [
        `/${locale}`,
        `/${locale}/experiences`,
        `/${locale}/experiences/${TEST_EXPERIENCES.wineTasting.slug}`,
        `/${locale}/wineries`,
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
    await page.goto(localizedPath('/experiences/not-a-real-experience'));

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('body')).toContainText(/not found|non trouv/i);
  });

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

    const isBlocked =
      !page.url().includes('/admin') ||
      (await page
        .locator('body')
        .filter({ hasText: /403|forbidden|access denied|accès refusé/i })
        .isVisible()
        .catch(() => false));

    expect(isBlocked).toBe(true);
  });
});
