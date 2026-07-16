import { Page, expect } from '@playwright/test';
import { acceptCookiesIfVisible } from '../utils/journeys';

/**
 * POM — winery onboarding journey (P-16 / L-181): registration with the
 * winemaker checkbox, then the winery wizard (step 1/2) to PENDING.
 */
export class OnboardingPage {
  constructor(private readonly page: Page) {}

  async register(input: { name: string; email: string; password: string }) {
    await this.page.goto('/fr/register');
    // The consent banner overlays the bottom of the form (pointer-blocks
    // the submit/continue buttons).
    await acceptCookiesIfVisible(this.page);
    const form = this.page.locator('form');
    await form.locator('input[name="name"], #name').first().fill(input.name);
    await form.locator('input[type="email"]').first().fill(input.email);
    const passwords = form.locator('input[type="password"]');
    await passwords.nth(0).fill(input.password);
    await passwords.nth(1).fill(input.password);
    // « Je suis vigneron » — shadcn checkbox (button role).
    await this.page.getByRole('checkbox').click();
    await this.page.getByRole('button', { name: 'Créer le compte' }).click();
    // Winemaker path lands on the winery wizard.
    await this.page.waitForURL(/onboarding\/winery/, { timeout: 15000 });
  }

  async fillWineryWizard(input: {
    name: string;
    description: string;
    address: string;
    commune: string;
    phone: string;
  }) {
    await this.page.getByLabel('Nom du domaine').fill(input.name);
    await this.page.getByLabel('Description').fill(input.description);
    await this.page.getByLabel('Adresse').fill(input.address);
    // Commune — shadcn Select.
    await this.page.getByLabel('Commune').click();
    await this.page.getByRole('option', { name: input.commune }).click();
    await this.page.getByLabel('Téléphone').fill(input.phone);
    // exact: the cookie banner's « Continuer sans accepter » also matches
    // the substring.
    await this.page
      .getByRole('button', { name: 'Continuer', exact: true })
      .click();
    await this.page.waitForURL(/onboarding\/winery\/confirmation/, {
      timeout: 15000,
    });
  }

  async expectPendingConfirmation() {
    await expect(
      this.page.getByText(/Étape 2 sur 2|attente/i).first()
    ).toBeVisible();
  }
}
