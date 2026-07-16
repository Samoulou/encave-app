/**
 * P-16 / L-181 — journey 5: check-in.
 * Scanner day-mode surface (preloaded ticket list + counter), then the
 * check-in through the occurrence sheet's per-booking action — the same
 * `checkInBooking` CAS the QR scanner calls (camera not drivable in CI;
 * the scan-source concurrency race is proven in
 * tests/db/collective-scan-concurrency.test.ts against a real Postgres).
 */
import { test, expect } from '../fixtures/auth.fixture';
import { TEST_USERS } from '../fixtures/auth.fixture';
import { ScanPage } from '../pages/scan.page';
import { loginAsFr } from '../utils/journeys';
import { testDb, findBookingByReference } from '../utils/db';

const BOOKING_REFERENCE = 'ENC-E2E101';

test.describe('Check-in journey', () => {
  test('scanner surface loads and the visitor is checked in once', async ({
    page,
  }) => {
    await loginAsFr(page, TEST_USERS.wineryOwner);
    const scan = new ScanPage(page);

    // 1. Day-mode scanner: preloaded list + counter for today's tickets.
    await scan.gotoScanner();
    await expect(scan.counter()).toBeVisible();

    // 2. Check-in via the occurrence sheet on today's session.
    const booking = await findBookingByReference(BOOKING_REFERENCE);
    expect(booking?.status).toBe('CONFIRMED');
    if (!booking) return;

    await scan.gotoSessions(booking.experienceId);
    await scan.openOccurrence(booking.timeSlot);
    await scan.checkInAttendee(booking.visitorName);

    const checked = await testDb().booking.findUnique({
      where: { id: booking.id },
    });
    expect(checked?.status).toBe('COMPLETED');
    expect(checked?.checkedInAt).not.toBeNull();

    // 3. A second check-in is not offered: the action menu (kept open by
    //    Radix after onSelect) now shows the ADR-0001 revert instead —
    //    proof the state machine moved and re-check-in is impossible.
    await expect(
      page.getByRole('menuitem', { name: 'Annuler le check-in' })
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: 'Marquer présent' })
    ).toBeHidden();
  });
});
