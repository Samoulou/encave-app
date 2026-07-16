import { Page, expect } from '@playwright/test';
import { authenticator } from 'otplib';

/**
 * POM — admin side of the onboarding journey (P-16 / L-181): mandatory
 * TOTP enrolment (P-14 / L-152, driven through the REAL flow — the secret
 * is read from the /two-factor/enable network response, never from a
 * backdoor) and the pending-winery approval.
 */
export class AdminVerificationPage {
  constructor(private readonly page: Page) {}

  /**
   * Complete the forced TOTP enrolment from /admin-setup/2fa and land on
   * /admin. Returns the TOTP secret for optional later logins.
   */
  async enrollTotp(password: string): Promise<string> {
    await this.page.waitForURL(/admin-setup\/2fa/, { timeout: 15000 });
    await this.page.locator('#totp-password').fill(password);
    const enableResponse = this.page.waitForResponse(
      (r) => r.url().includes('/two-factor/enable') && r.ok()
    );
    await this.page.getByRole('button', { name: 'Activer' }).click();
    const body = (await (await enableResponse).json()) as {
      totpURI: string;
    };
    const secret = new URL(body.totpURI).searchParams.get('secret');
    if (!secret) {
      throw new Error('totpURI has no secret param');
    }
    await this.page.locator('#totp-code').fill(authenticator.generate(secret));
    await this.page
      .getByRole('button', { name: 'Vérifier et activer' })
      .click();
    await this.page.waitForURL(/\/admin(?!-setup)/, { timeout: 15000 });
    return secret;
  }

  async approveWinery(wineryName: string) {
    await this.page.goto('/fr/admin/wineries/pending');
    const row = this.page
      .locator('tr, li, div[class*="card"]')
      .filter({ hasText: wineryName })
      .first();
    await row.getByRole('button', { name: 'Examiner' }).click();
    await this.page.waitForURL(/admin\/wineries\/(?!pending)/);
    await this.page.getByRole('button', { name: 'Approuver' }).click();
    const dialog = this.page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Oui, Approuver' }).click();
    await expect(
      this.page.getByText('Domaine approuvé avec succès')
    ).toBeVisible();
  }
}
