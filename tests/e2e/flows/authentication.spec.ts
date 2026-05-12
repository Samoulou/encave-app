import { test, expect } from '@playwright/test';
import { LoginPage, RegisterPage, AuthHeader } from '../pages';
import { TEST_USERS } from '../fixtures/auth.fixture';

/**
 * Authentication E2E Tests
 *
 * Ces tests vérifient les parcours d'authentification :
 * - Login (succès, échec, redirection selon rôle)
 * - Register (CLIENT, WINEMAKER, validation)
 * - Routes protégées
 * - Logout
 */

// ============================================================
// TEST DATA
// ============================================================

/**
 * Generate unique email for registration tests
 */
function generateUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Valid password meeting all requirements
 */
const VALID_PASSWORD = 'TestPassword123!';

/**
 * Invalid passwords for validation tests
 */
const INVALID_PASSWORDS = {
  tooShort: 'Test1!',
  noNumber: 'TestPassword!',
  noUppercase: 'testpassword123!',
  noLowercase: 'TESTPASSWORD123!',
  noSpecialChar: 'TestPassword123',
};

// ============================================================
// LOGIN TESTS
// ============================================================

test.describe('Authentification - Login', () => {
  test.describe('Login réussi', () => {
    test('un CLIENT peut se connecter et est redirigé vers /dashboard', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.login({
        email: TEST_USERS.guest.email,
        password: TEST_USERS.guest.password,
      });

      // Vérifier la redirection
      await loginPage.waitForLoginRedirect('CLIENT');
      await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('un WINEMAKER peut se connecter et est redirigé vers /dashboard/bookings', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.login({
        email: TEST_USERS.wineryOwner.email,
        password: TEST_USERS.wineryOwner.password,
      });

      // Vérifier la redirection
      await loginPage.waitForLoginRedirect('WINEMAKER');
      await expect(page).toHaveURL(/\/dashboard\/bookings/);
    });

    test('un ADMIN peut se connecter et est redirigé vers /admin', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.login({
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      });

      // Vérifier la redirection
      await loginPage.waitForLoginRedirect('ADMIN');
      await expect(page).toHaveURL(/\/admin/);
    });

    test('le callbackUrl redirige vers la page demandée après login', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const targetUrl = '/experiences';

      await loginPage.navigate(targetUrl);
      await loginPage.login({
        email: TEST_USERS.guest.email,
        password: TEST_USERS.guest.password,
      });

      // Vérifier la redirection vers la page demandée
      await page.waitForURL(/\/experiences/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/experiences/);
    });
  });

  test.describe('Login échoué', () => {
    test('affiche une erreur avec des credentials invalides', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.login({
        email: 'invalid@example.com',
        password: 'wrongpassword',
      });

      // Vérifier le message d'erreur
      const hasError = await loginPage.hasError();
      expect(hasError).toBe(true);

      // L'URL doit rester sur /login
      await expect(page).toHaveURL(/\/login/);
    });

    test('affiche une erreur avec un mot de passe incorrect', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.login({
        email: TEST_USERS.guest.email,
        password: 'wrongpassword123!',
      });

      // Vérifier le message d'erreur
      const hasError = await loginPage.hasError();
      expect(hasError).toBe(true);
    });

    test('affiche une erreur avec un email mal formaté', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.fillForm({
        email: 'invalid-email',
        password: VALID_PASSWORD,
      });
      await loginPage.submit();

      // Le formulaire ne doit pas soumettre (validation client)
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('UI Login', () => {
    test('le lien "Créer un compte" redirige vers /register', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.registerLink.click();

      await expect(page).toHaveURL(/\/register/);
    });

    test('le bouton afficher/masquer mot de passe fonctionne', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.navigate();
      await loginPage.passwordInput.fill('testpassword');

      // Par défaut, le mot de passe est masqué
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

      // Cliquer pour afficher
      await loginPage.togglePasswordVisibility();

      // Maintenant le type devrait être 'text'
      const passwordField = page.locator(
        'input[autocomplete="current-password"]'
      );
      await expect(passwordField).toHaveAttribute('type', 'text');
    });
  });
});

// ============================================================
// REGISTER TESTS
// ============================================================

test.describe('Authentification - Register', () => {
  test.describe('Registration réussie', () => {
    test("un nouveau CLIENT peut s'inscrire", async ({ page }) => {
      const registerPage = new RegisterPage(page);
      const uniqueEmail = generateUniqueEmail();

      await registerPage.navigate();
      await registerPage.register({
        name: 'Test User Client',
        email: uniqueEmail,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
        isWinemaker: false,
      });

      // Vérifier la redirection vers le dashboard
      await registerPage.waitForRegistrationRedirect(false);
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("un nouveau WINEMAKER peut s'inscrire", async ({ page }) => {
      const registerPage = new RegisterPage(page);
      const uniqueEmail = generateUniqueEmail();

      await registerPage.navigate();
      await registerPage.register({
        name: 'Test Winemaker',
        email: uniqueEmail,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
        isWinemaker: true,
      });

      // Vérifier la redirection vers l'onboarding winery
      await registerPage.waitForRegistrationRedirect(true);
      await expect(page).toHaveURL(/\/onboarding\/winery/);
    });

    test('le paramètre ?winemaker=true pré-coche la checkbox', async ({
      page,
    }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate(true); // asWinemaker = true

      // Vérifier que la checkbox est cochée
      await expect(registerPage.winemakerCheckbox).toBeChecked();
    });
  });

  test.describe('Validation du formulaire', () => {
    test('refuse un mot de passe trop court', async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();
      await registerPage.fillForm({
        name: 'Test User',
        email: generateUniqueEmail(),
        password: INVALID_PASSWORDS.tooShort,
        confirmPassword: INVALID_PASSWORDS.tooShort,
      });
      await registerPage.submit();

      // Doit rester sur la page register
      await expect(page).toHaveURL(/\/register/);
    });

    test('refuse un mot de passe sans chiffre', async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();
      await registerPage.fillForm({
        name: 'Test User',
        email: generateUniqueEmail(),
        password: INVALID_PASSWORDS.noNumber,
        confirmPassword: INVALID_PASSWORDS.noNumber,
      });
      await registerPage.submit();

      await expect(page).toHaveURL(/\/register/);
    });

    test('refuse si les mots de passe ne correspondent pas', async ({
      page,
    }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();
      await registerPage.fillForm({
        name: 'Test User',
        email: generateUniqueEmail(),
        password: VALID_PASSWORD,
        confirmPassword: 'DifferentPassword123!',
      });
      await registerPage.submit();

      await expect(page).toHaveURL(/\/register/);
    });

    test('refuse un nom trop court', async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();
      await registerPage.fillForm({
        name: 'A', // Trop court (min 2 caractères)
        email: generateUniqueEmail(),
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      });
      await registerPage.submit();

      await expect(page).toHaveURL(/\/register/);
    });

    test('refuse un email déjà utilisé', async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();
      await registerPage.register({
        name: 'Test User',
        email: TEST_USERS.guest.email, // Email existant
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      });

      // Vérifier le message d'erreur
      const hasError = await registerPage.hasError();
      expect(hasError).toBe(true);

      // Doit rester sur register
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('UI Register', () => {
    test('le lien "Se connecter" redirige vers /login', async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();
      await registerPage.loginLink.click();

      await expect(page).toHaveURL(/\/login/);
    });

    test("l'indice de mot de passe est visible", async ({ page }) => {
      const registerPage = new RegisterPage(page);

      await registerPage.navigate();

      // Vérifier que l'indice de mot de passe est présent
      const hint = page.locator('text=/8.*characters|8.*caractères/i');
      await expect(hint).toBeVisible();
    });
  });
});

// ============================================================
// PROTECTED ROUTES TESTS
// ============================================================

test.describe('Routes protégées', () => {
  test('un utilisateur non connecté est redirigé vers /login depuis /dashboard', async ({
    page,
  }) => {
    // Tenter d'accéder au dashboard sans être connecté
    await page.goto('/dashboard');

    // Doit être redirigé vers login avec callbackUrl
    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get('callbackUrl')).toContain('/dashboard');
  });

  test('un utilisateur non connecté est redirigé vers /login depuis /dashboard/bookings', async ({
    page,
  }) => {
    await page.goto('/dashboard/bookings');

    await expect(page).toHaveURL(/\/login/);
  });

  test('un utilisateur non connecté est redirigé vers /login depuis /admin', async ({
    page,
  }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/login/);
  });

  test('un utilisateur non connecté est redirigé vers /login depuis /onboarding/winery', async ({
    page,
  }) => {
    await page.goto('/onboarding/winery');

    await expect(page).toHaveURL(/\/login/);
  });

  test('les pages publiques sont accessibles sans connexion', async ({
    page,
  }) => {
    // Page d'accueil
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);

    // Page des expériences
    await page.goto('/experiences');
    await expect(page).not.toHaveURL(/\/login/);

    // Page des domaines
    await page.goto('/wineries');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("un utilisateur connecté est redirigé depuis /login vers la page d'accueil", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);

    // D'abord se connecter
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await loginPage.waitForLoginRedirect('CLIENT');

    // Essayer d'accéder à /login
    await page.goto('/login');

    // Doit être redirigé (pas rester sur /login)
    await expect(page).not.toHaveURL(/\/login$/);
  });
});

// ============================================================
// LOGOUT TESTS
// ============================================================

test.describe('Logout', () => {
  test('un utilisateur peut se déconnecter', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Se connecter
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await loginPage.waitForLoginRedirect('CLIENT');

    // Chercher et cliquer sur le bouton de déconnexion
    // Ouvrir le menu utilisateur si présent
    const userMenuButton = page
      .getByTestId('user-menu')
      .or(page.getByRole('button', { name: /account|profile|compte|menu/i }));

    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
    }

    // Cliquer sur déconnexion
    const logoutButton = page
      .getByRole('menuitem', { name: /log out|sign out|déconnexion/i })
      .or(page.getByRole('button', { name: /log out|sign out|déconnexion/i }))
      .or(page.getByRole('link', { name: /log out|sign out|déconnexion/i }));

    await logoutButton.click();

    // Vérifier qu'on n'a plus accès au dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('après déconnexion, les routes protégées ne sont plus accessibles', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);

    // Se connecter
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await loginPage.waitForLoginRedirect('CLIENT');

    // Se déconnecter via l'API directement (plus fiable)
    await page.goto('/api/auth/signout');
    await page
      .getByRole('button', { name: /sign out/i })
      .click()
      .catch(() => {
        // Si pas de confirmation, continuer
      });

    // Attendre un peu pour que la session soit invalidée
    await page.waitForTimeout(1000);

    // Vérifier que le dashboard n'est plus accessible
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ============================================================
// SESSION PERSISTENCE TESTS
// ============================================================

test.describe('Persistance de session', () => {
  test('la session persiste après un refresh de page', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Se connecter
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await loginPage.waitForLoginRedirect('CLIENT');

    // Refresh la page
    await page.reload();

    // Toujours sur le dashboard (session persistée)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('la session persiste lors de la navigation', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Se connecter
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await loginPage.waitForLoginRedirect('CLIENT');

    // Naviguer vers une autre page
    await page.goto('/experiences');

    // Revenir au dashboard
    await page.goto('/dashboard');

    // Toujours connecté
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ============================================================
// ROLE-BASED ACCESS TESTS
// ============================================================

test.describe("Contrôle d'accès basé sur les rôles", () => {
  test('un CLIENT ne peut pas accéder à /admin', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Se connecter en tant que CLIENT
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.guest.email,
      password: TEST_USERS.guest.password,
    });
    await loginPage.waitForLoginRedirect('CLIENT');

    // Essayer d'accéder à /admin
    await page.goto('/admin');

    // Doit être redirigé ou voir une erreur 403
    const url = page.url();
    const isBlocked =
      !url.includes('/admin') ||
      (await page
        .locator('text=/access denied|forbidden|403/i')
        .isVisible()
        .catch(() => false));
    expect(isBlocked).toBe(true);
  });

  test('un WINEMAKER peut accéder à /dashboard/experiences', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);

    // Se connecter en tant que WINEMAKER
    await loginPage.navigate();
    await loginPage.login({
      email: TEST_USERS.wineryOwner.email,
      password: TEST_USERS.wineryOwner.password,
    });
    await loginPage.waitForLoginRedirect('WINEMAKER');

    // Accéder au dashboard experiences
    await page.goto('/dashboard/experiences');

    // Doit pouvoir y accéder
    await expect(page).toHaveURL(/\/dashboard\/experiences/);
  });
});
