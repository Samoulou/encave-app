import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { BookingStatus, OccurrenceStatus } from '@prisma/client';
import { OccurrenceDetailSheet } from '@/components/features/occurrence/OccurrenceDetailSheet';
import {
  closeOccurrence,
  reopenOccurrence,
  setOccurrenceCapacity,
} from '@/server/actions/occurrence';
import type { OccurrenceCalendarEntryDTO } from '@/server/queries/occurrence.queries';

vi.mock('@/server/actions/occurrence', () => ({
  closeOccurrence: vi.fn(),
  reopenOccurrence: vi.fn(),
  setOccurrenceCapacity: vi.fn(),
}));

// Day-J booking actions (re-homed from the legacy event-detail view) —
// imported by BookingActionsMenu/Sheet, CancelSessionButton and
// ContactGuestsButton, which the sheet now renders.
vi.mock('@/server/actions/event-detail', () => ({
  markBookingCheckedIn: vi.fn(),
  markBookingNoShow: vi.fn(),
  revertBookingCheckIn: vi.fn(),
  revertBookingNoShow: vi.fn(),
  cancelEventSession: vi.fn(),
  getAttendeeEmailsForSession: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseEntry: OccurrenceCalendarEntryDTO = {
  occurrenceId: 'occ_1',
  date: new Date('2026-07-11T00:00:00.000Z'),
  startTime: '10:00',
  status: OccurrenceStatus.OPEN,
  capacity: 8,
  capacityOverride: null,
  bookedCount: 3,
  isDateBlocked: false,
  servedWineIds: [],
  attendees: [
    {
      bookingId: 'bkg_1',
      reference: 'ENC-ABC12345',
      visitorName: 'Jean Dupont',
      guestCount: 2,
      status: BookingStatus.CONFIRMED,
    },
  ],
};

function renderSheet(
  entry: OccurrenceCalendarEntryDTO | null,
  overrides: Partial<{
    dayEntries: OccurrenceCalendarEntryDTO[];
    canEdit: boolean;
    durationMinutes: number;
  }> = {}
) {
  return render(
    <OccurrenceDetailSheet
      entry={entry}
      dayEntries={overrides.dayEntries ?? (entry ? [entry] : [])}
      experienceId="ckexperienceabcdefghij123"
      experienceSlug="degustation-verticale"
      experienceTitle="Dégustation verticale"
      wineryName="Domaine X"
      durationMinutes={overrides.durationMinutes ?? 90}
      canEdit={overrides.canEdit ?? true}
      tastingWines={null}
      onOpenChange={vi.fn()}
    />
  );
}

describe('OccurrenceDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Anchor "now" two days before baseEntry's session so the future /
    // past / scan-window deriveds are deterministic.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders nothing when entry is null', () => {
    renderSheet(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the seat gauge with the booked count', () => {
    renderSheet(baseEntry);
    const gauge = screen.getByRole('progressbar');
    expect(gauge.getAttribute('aria-valuenow')).toBe('3');
    expect(gauge.getAttribute('aria-valuemax')).toBe('8');
  });

  it('lists attendees with their reference', () => {
    renderSheet(baseEntry);
    expect(screen.getByText('Jean Dupont')).toBeDefined();
    expect(screen.getByText('ENC-ABC12345')).toBeDefined();
  });

  it('closes an OPEN occurrence via closeOccurrence', async () => {
    vi.mocked(closeOccurrence).mockResolvedValue({
      success: true,
      data: { status: OccurrenceStatus.CLOSED },
    });
    renderSheet(baseEntry);

    fireEvent.click(screen.getByText('sheet.close'));

    await waitFor(() => {
      expect(closeOccurrence).toHaveBeenCalledWith({ occurrenceId: 'occ_1' });
    });
  });

  it('reopens a CLOSED occurrence via reopenOccurrence', async () => {
    vi.mocked(reopenOccurrence).mockResolvedValue({
      success: true,
      data: { status: OccurrenceStatus.OPEN },
    });
    renderSheet({ ...baseEntry, status: OccurrenceStatus.CLOSED });

    fireEvent.click(screen.getByText('sheet.reopen'));

    await waitFor(() => {
      expect(reopenOccurrence).toHaveBeenCalledWith({ occurrenceId: 'occ_1' });
    });
  });

  it('applies a capacity override within bounds', async () => {
    vi.mocked(setOccurrenceCapacity).mockResolvedValue({
      success: true,
      data: { capacityOverride: 5 },
    });
    renderSheet(baseEntry);

    fireEvent.change(screen.getByLabelText('sheet.capacityLabel'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByText('sheet.apply'));

    await waitFor(() => {
      expect(setOccurrenceCapacity).toHaveBeenCalledWith({
        occurrenceId: 'occ_1',
        capacityOverride: 5,
      });
    });
  });

  it('rejects an out-of-bounds capacity without calling the action', () => {
    renderSheet(baseEntry);

    fireEvent.change(screen.getByLabelText('sheet.capacityLabel'), {
      target: { value: '99' },
    });
    fireEvent.click(screen.getByText('sheet.apply'));

    expect(setOccurrenceCapacity).not.toHaveBeenCalled();
    expect(screen.getByText('sheet.capacityInvalid')).toBeDefined();
  });

  it('resets the override to null', async () => {
    vi.mocked(setOccurrenceCapacity).mockResolvedValue({
      success: true,
      data: { capacityOverride: null },
    });
    renderSheet({ ...baseEntry, capacityOverride: 4, capacity: 4 });

    fireEvent.click(screen.getByText('sheet.reset'));

    await waitFor(() => {
      expect(setOccurrenceCapacity).toHaveBeenCalledWith({
        occurrenceId: 'occ_1',
        capacityOverride: null,
      });
    });
  });

  it('disables occurrence management for straggler sessions (occurrenceId null)', () => {
    renderSheet({ ...baseEntry, occurrenceId: null });

    expect(screen.getByText('sheet.legacyNote')).toBeDefined();
    expect(screen.queryByText('sheet.close')).toBeNull();
    expect(screen.queryByText('sheet.apply')).toBeNull();
  });

  it('disables actions on a CANCELLED occurrence', () => {
    renderSheet({ ...baseEntry, status: OccurrenceStatus.CANCELLED });

    // A non-OPEN occurrence shows the reopen action — disabled here.
    const toggleButton = screen.getByText('sheet.reopen').closest('button');
    expect(toggleButton?.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('sheet.cancelledNote')).toBeDefined();
  });

  it('surfaces action errors as a toast', async () => {
    const { toast } = await import('sonner');
    vi.mocked(closeOccurrence).mockResolvedValue({
      success: false,
      error: { code: 'CONFLICT', message: 'nope' },
    });
    renderSheet(baseEntry);

    fireEvent.click(screen.getByText('sheet.close'));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('errors.conflict');
    });
  });

  describe('day-J tooling (re-homed from the legacy sessions view)', () => {
    it('renders per-attendee action menus for actionable bookings', () => {
      renderSheet(baseEntry);

      // Desktop dropdown + mobile bottom-sheet variants for the CONFIRMED
      // attendee (visibility is CSS-only, both are in the DOM).
      expect(screen.getAllByLabelText('actions.openMenu')).toHaveLength(2);
    });

    it('lists cancelled bookings struck through, without actions', () => {
      renderSheet({
        ...baseEntry,
        attendees: [
          {
            bookingId: 'bkg_2',
            reference: 'ENC-CANCEL01',
            visitorName: 'Marie Annulée',
            guestCount: 3,
            status: BookingStatus.CANCELLED_BY_CLIENT,
          },
        ],
      });

      const name = screen.getByText('Marie Annulée');
      expect(name.className).toContain('line-through');
      expect(screen.getByText('cancelledByClient')).toBeDefined();
      // Both action variants render null on cancelled bookings.
      expect(screen.queryByLabelText('actions.openMenu')).toBeNull();
    });

    it('shows the session tools including the scanner entry point', () => {
      renderSheet(baseEntry);

      expect(screen.getByText('scanQr')).toBeDefined();
      expect(screen.getByText('contactAll')).toBeDefined();
      expect(screen.getByText('cancelSession')).toBeDefined();
      // Two days before the session: outside the H-2/H+2 window — the
      // scanner CTA is present but disabled.
      const scanButton = screen.getByText('scanQr').closest('button');
      expect(scanButton?.hasAttribute('disabled')).toBe(true);
    });

    it('enables the scanner inside the daily H-2/H+2 window', () => {
      // 09:00 Zurich (07:00 UTC in July, CEST) — one hour before the
      // 10:00 session: inside the window.
      vi.setSystemTime(new Date('2026-07-11T07:00:00.000Z'));
      renderSheet(baseEntry);

      const scanButton = screen.getByText('scanQr').closest('button');
      expect(scanButton?.hasAttribute('disabled')).toBe(false);
    });

    it('hides the session tools when the experience is archived', () => {
      renderSheet(baseEntry, { canEdit: false });

      expect(screen.queryByText('scanQr')).toBeNull();
      expect(screen.queryByText('cancelSession')).toBeNull();
      // Attendee list still renders, read-only day-J actions gated off.
      expect(screen.getByText('Jean Dupont')).toBeDefined();
    });

    it('hides the session tools once the session is past', () => {
      // Two days after the session ended.
      vi.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
      renderSheet(baseEntry);

      expect(screen.queryByText('scanQr')).toBeNull();
      expect(screen.queryByText('cancelSession')).toBeNull();
    });
  });
});
