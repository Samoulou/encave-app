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

describe('OccurrenceDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when entry is null', () => {
    render(<OccurrenceDetailSheet entry={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the seat gauge with the booked count', () => {
    render(<OccurrenceDetailSheet entry={baseEntry} onOpenChange={vi.fn()} />);
    const gauge = screen.getByRole('progressbar');
    expect(gauge.getAttribute('aria-valuenow')).toBe('3');
    expect(gauge.getAttribute('aria-valuemax')).toBe('8');
  });

  it('lists attendees with their reference', () => {
    render(<OccurrenceDetailSheet entry={baseEntry} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Jean Dupont')).toBeDefined();
    expect(screen.getByText('ENC-ABC12345')).toBeDefined();
  });

  it('closes an OPEN occurrence via closeOccurrence', async () => {
    vi.mocked(closeOccurrence).mockResolvedValue({
      success: true,
      data: { status: OccurrenceStatus.CLOSED },
    });
    render(<OccurrenceDetailSheet entry={baseEntry} onOpenChange={vi.fn()} />);

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
    render(
      <OccurrenceDetailSheet
        entry={{ ...baseEntry, status: OccurrenceStatus.CLOSED }}
        onOpenChange={vi.fn()}
      />
    );

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
    render(<OccurrenceDetailSheet entry={baseEntry} onOpenChange={vi.fn()} />);

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
    render(<OccurrenceDetailSheet entry={baseEntry} onOpenChange={vi.fn()} />);

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
    render(
      <OccurrenceDetailSheet
        entry={{ ...baseEntry, capacityOverride: 4, capacity: 4 }}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('sheet.reset'));

    await waitFor(() => {
      expect(setOccurrenceCapacity).toHaveBeenCalledWith({
        occurrenceId: 'occ_1',
        capacityOverride: null,
      });
    });
  });

  it('disables management for straggler sessions (occurrenceId null)', () => {
    render(
      <OccurrenceDetailSheet
        entry={{ ...baseEntry, occurrenceId: null }}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('sheet.legacyNote')).toBeDefined();
    expect(screen.queryByText('sheet.close')).toBeNull();
    expect(screen.queryByText('sheet.apply')).toBeNull();
  });

  it('disables actions on a CANCELLED occurrence', () => {
    render(
      <OccurrenceDetailSheet
        entry={{ ...baseEntry, status: OccurrenceStatus.CANCELLED }}
        onOpenChange={vi.fn()}
      />
    );

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
    render(<OccurrenceDetailSheet entry={baseEntry} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('sheet.close'));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('errors.conflict');
    });
  });
});
