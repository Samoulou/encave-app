import { Page, expect } from '@playwright/test';

/**
 * POM — sur-mesure request journey (P-16 / L-181): public form, winemaker
 * offer composition, client payment page. French routes/texts.
 */
export class RequestPage {
  constructor(private readonly page: Page) {}

  async gotoPublicForm() {
    await this.page.goto('/fr/sur-mesure');
    await expect(this.page.locator('#clientEmail')).toBeVisible();
  }

  async fillPublicForm(input: {
    wineryName: string;
    clientName: string;
    clientEmail: string;
    description: string;
    guestCount?: number;
  }) {
    // shadcn Select — trigger carries the field id.
    await this.page.locator('#wineryId').click();
    await this.page.getByRole('option', { name: input.wineryName }).click();
    await this.page.locator('#clientName').fill(input.clientName);
    await this.page.locator('#clientEmail').fill(input.clientEmail);
    if (input.guestCount) {
      await this.page.locator('#guestCount').fill(String(input.guestCount));
    }
    await this.page.locator('#description').fill(input.description);
  }

  async submitPublicForm() {
    await this.page.getByRole('button', { name: 'Envoyer ma demande' }).click();
    await expect(this.page.getByText('Demande envoyée !')).toBeVisible();
  }

  async gotoInbox() {
    await this.page.goto('/fr/dashboard/demandes');
    await expect(
      this.page.getByRole('heading', { name: 'Demandes sur-mesure' })
    ).toBeVisible();
  }

  async openRequest(clientName: string) {
    await this.page.getByRole('link', { name: new RegExp(clientName) }).click();
    await expect(this.page.locator('#totalPriceChf')).toBeVisible();
  }

  async composeOffer(input: {
    message: string;
    totalPriceChf: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
  }) {
    await this.page.locator('#message').fill(input.message);
    await this.page.locator('#totalPriceChf').fill(input.totalPriceChf);
    await this.page.locator('#scheduledDate').fill(input.date);
    await this.page.locator('#scheduledStartTime').fill(input.time);
    await this.page.getByRole('button', { name: "Envoyer l'offre" }).click();
    // The page refreshes without the compose form once the offer is SENT.
    await expect(this.page.locator('#totalPriceChf')).toBeHidden();
  }

  async gotoOffer(token: string) {
    await this.page.goto(`/fr/sur-mesure/offre/${token}`);
  }

  async payOffer() {
    await this.page.getByRole('button', { name: 'Payer et confirmer' }).click();
  }
}
