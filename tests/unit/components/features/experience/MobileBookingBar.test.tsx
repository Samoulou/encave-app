import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MobileBookingBar } from '@/components/features/experience/MobileBookingBar';

vi.mock('@/components/features/experience/MobileBookingDrawer', () => ({
  MobileBookingDrawer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mobile-booking-drawer" /> : null,
}));

function renderBar() {
  return render(
    <MobileBookingBar
      price={4500}
      experienceSlug="degustation"
      experienceId="ckexperienceabcdefghij123456"
      stripeConnected={true}
      minCapacity={1}
      maxCapacity={8}
      duration={90}
      availabilitySlots={[{ dayOfWeek: 5, startTime: '14:00', endTime: '15:30', isActive: true }]}
    />
  );
}

describe('MobileBookingBar', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('is hidden before the visitor scrolls past the hero area', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    renderBar();

    const bar = screen.getByText('CHF 45.00').closest('[aria-hidden]');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveClass('translate-y-full');
  });

  it('becomes visible after scrolling down the page', () => {
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });

    renderBar();
    fireEvent.scroll(window);

    const bar = screen.getByText('CHF 45.00').closest('[aria-hidden]');
    expect(bar).toHaveAttribute('aria-hidden', 'false');
    expect(bar).toHaveClass('translate-y-0');
  });

  it('hides while a form field has focus', () => {
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });
    const input = document.createElement('input');
    document.body.appendChild(input);

    renderBar();
    input.focus();
    fireEvent.focusIn(window);

    const bar = screen.getByText('CHF 45.00').closest('[aria-hidden]');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens the booking drawer from the mobile CTA', () => {
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });

    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Book This Experience' }));

    expect(screen.getByTestId('mobile-booking-drawer')).toBeInTheDocument();
  });
});
