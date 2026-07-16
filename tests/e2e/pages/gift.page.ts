import { Page, expect } from '@playwright/test';

/**
 * POM — gift purchase configurator (/fr/cadeaux) and gift redemption at
 * checkout (P-16 / L-181). French routes/texts by design: FR is the
 * product's primary locale; structural #ids where available.
 */
export class GiftPage {
  constructor(private readonly page: Page) {}

  async gotoConfigurator() {
    await this.page.goto('/fr/cadeaux');
    await expect(this.page.locator('#purchaserEmail')).toBeVisible();
  }

  /** Fill the AMOUNT-nature configurator (default 100 CHF card). */
  async fillAmountGift(input: {
    purchaserName: string;
    purchaserEmail: string;
    recipientEmail: string;
    recipientName?: string;
    message?: string;
  }) {
    await this.page.locator('#purchaserName').fill(input.purchaserName);
    await this.page.locator('#purchaserEmail').fill(input.purchaserEmail);
    if (input.recipientName) {
      await this.page.locator('#recipientName').fill(input.recipientName);
    }
    await this.page.locator('#recipientEmail').fill(input.recipientEmail);
    if (input.message) {
      await this.page.locator('#message').fill(input.message);
    }
  }

  async submitToPayment() {
    await this.page.getByRole('button', { name: 'Payer et offrir' }).click();
  }

  /**
   * The gift code field on the booking checkout — two responsive twins
   * (mobile + desktop aside), only the visible one is fillable.
   */
  giftCodeInput() {
    return this.page.locator('#giftCode >> visible=true').first();
  }

  async applyGiftCode(code: string) {
    await this.giftCodeInput().fill(code);
    await this.page
      .locator('button:visible', { hasText: 'Appliquer' })
      .first()
      .click();
    // Applied note replaces the input: « {amount} appliqués sur ce paiement. »
    // (two responsive twins — assert the visible one, 10s for the preview
    // action roundtrip)
    await expect(
      this.page
        .locator('p:visible', { hasText: 'appliqués sur ce paiement' })
        .first()
    ).toBeVisible({ timeout: 10000 });
  }
}
