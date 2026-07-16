import { Page, expect } from '@playwright/test';

/**
 * POM — check-in journey (P-16 / L-181). The QR camera itself is not
 * drivable in CI (getUserMedia); the journey covers the scan page's
 * day-mode surface (preloaded ticket list, counters) and performs the
 * check-in through the occurrence sheet's per-booking action — the SAME
 * `checkInBooking` CAS the scanner calls (source manual vs scan). The
 * scan-source concurrency race is proven against a real Postgres by
 * tests/db/collective-scan-concurrency.test.ts.
 */
export class ScanPage {
  constructor(private readonly page: Page) {}

  async gotoScanner() {
    await this.page.goto('/fr/dashboard/scan');
    await expect(
      this.page.getByRole('heading', { name: 'Scanner les QR codes' })
    ).toBeVisible();
  }

  /** Day-mode counter: « {checkedIn} / {total} clients enregistres ». */
  counter() {
    return this.page.getByText(/\d+ \/ \d+ clients/);
  }

  async gotoSessions(experienceId: string) {
    await this.page.goto(`/fr/dashboard/experiences/${experienceId}/sessions`);
  }

  /** Open today's occurrence pill (e.g. « 10:00 · 2/8 ») in the calendar. */
  async openOccurrence(startTime: string) {
    await this.page
      .getByRole('button', { name: new RegExp(`^${startTime} ·`) })
      .first()
      .click();
    // Sheet shows the attendees block.
    await expect(this.page.getByText(/inscrit/).first()).toBeVisible();
  }

  /** Check a visitor in from the attendee row's actions menu. */
  async checkInAttendee(visitorName: string) {
    const row = this.page.locator('li', { hasText: visitorName }).first();
    await row.getByRole('button', { name: "Ouvrir le menu d'actions" }).click();
    await this.page.getByRole('menuitem', { name: 'Marquer présent' }).click();
    await expect(
      this.page.getByText('Présence enregistrée.').first()
    ).toBeVisible();
  }
}
