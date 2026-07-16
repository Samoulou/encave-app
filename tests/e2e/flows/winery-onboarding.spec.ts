/**
 * P-16 / L-181 — journey 6: winery onboarding A→Z.
 * Registration (winemaker checkbox) → winery wizard → PENDING →
 * admin TOTP enrolment through the REAL forced-setup flow (P-14/L-152,
 * secret read from the /two-factor/enable response) → approval → VERIFIED.
 * Stripe Connect hosted onboarding is not drivable in CI — the fake
 * account attach mirrors the staging-verified flow (plan P-16 §WS-C).
 */
import { test, expect } from '../fixtures/auth.fixture';
import { TEST_USERS } from '../fixtures/auth.fixture';
import { OnboardingPage } from '../pages/onboarding.page';
import { AdminVerificationPage } from '../pages/admin-verification.page';
import { loginAsFr } from '../utils/journeys';
import { testDb, attachFakeStripeAccount } from '../utils/db';

test.describe('Winery onboarding A→Z', () => {
  test('register → wizard → admin approves → VERIFIED', async ({
    page,
    browser,
  }) => {
    const run = Date.now();
    const email = `e2e-onboarding-${run}@test.encave.ch`;
    const wineryName = `Cave Onboarding ${run}`;

    // 1. Registration with the winemaker checkbox → winery wizard.
    const onboarding = new OnboardingPage(page);
    await onboarding.register({
      name: 'Onboarding Winemaker',
      email,
      password: 'TestPassword123!',
    });
    await onboarding.fillWineryWizard({
      name: wineryName,
      description:
        'Domaine familial au cœur du Valais, spécialisé en Petite Arvine et Cornalin depuis trois générations.',
      address: 'Route des Vignes 12',
      commune: 'Sion',
      phone: '+41 27 555 00 10',
    });

    const pending = await testDb().winery.findFirst({
      where: { name: wineryName },
    });
    expect(pending?.status).toBe('PENDING');
    if (!pending) return;

    // 2. Admin journey: forced TOTP enrolment (real flow) then approval.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    // Dedicated admin: the TOTP enrolment is once-per-account and the
    // regression matrix enrolls TEST_USERS.admin in parallel.
    await loginAsFr(adminPage, TEST_USERS.adminOnboarding);
    const admin = new AdminVerificationPage(adminPage);
    await admin.enrollTotp(TEST_USERS.adminOnboarding.password);
    await admin.approveWinery(wineryName);
    await adminContext.close();

    const verified = await testDb().winery.findUnique({
      where: { id: pending.id },
    });
    expect(verified?.status).toBe('VERIFIED');

    // 3. Stripe Connect: hosted onboarding is external — attach the fake
    //    account (staging covers the real flow). The WINEMAKER role is
    //    stamped on the session at login (P-14) — re-login for a fresh
    //    session, which must land on the winemaker dashboard.
    await attachFakeStripeAccount(pending.id);
    await page.context().clearCookies();
    await loginAsFr(page, {
      email,
      password: 'TestPassword123!',
      name: '',
      role: 'winery_owner',
    });
    await page.goto('/fr/dashboard');
    await expect(
      page.getByRole('heading', { name: "Aujourd'hui" })
    ).toBeVisible();
    expect(page.url()).not.toContain('/onboarding');
  });
});
