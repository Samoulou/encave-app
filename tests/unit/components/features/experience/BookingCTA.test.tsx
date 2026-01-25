import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BookingCTA } from '@/components/features/experience/BookingCTA';

const messages = {
  booking: {
    perPerson: 'per person',
    bookNow: 'Book This Experience',
    comingSoon: 'Booking coming soon!',
    comingSoonTitle: 'Online booking coming soon!',
    contactWinery: 'Contact the winery directly to book this experience.',
  },
};

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('BookingCTA', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when Stripe is not connected', () => {
    it('renders price correctly', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={false}
        />
      );

      expect(screen.getByText('CHF 50.00')).toBeDefined();
    });

    it('renders per person text', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={false}
        />
      );

      expect(screen.getByText('per person')).toBeDefined();
    });

    it('renders book button as disabled', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={false}
        />
      );

      const button = screen.getByRole('button', { name: /Book This Experience/i });
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('shows coming soon message', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={false}
        />
      );

      expect(screen.getByText('Online booking coming soon!')).toBeDefined();
    });

    it('shows contact winery message', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={false}
        />
      );

      expect(
        screen.getByText('Contact the winery directly to book this experience.')
      ).toBeDefined();
    });

    it('renders correctly with high price', () => {
      renderWithI18n(
        <BookingCTA
          price={15000}
          experienceSlug="test-experience"
          stripeConnected={false}
        />
      );

      expect(screen.getByText('CHF 150.00')).toBeDefined();
    });
  });

  describe('when Stripe is connected', () => {
    it('renders book button as enabled and scrolls to booking widget on click', () => {
      // Mock scrollIntoView
      const scrollIntoViewMock = vi.fn();
      const mockElement = { scrollIntoView: scrollIntoViewMock };
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as unknown as HTMLElement);

      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={true}
        />
      );

      const button = screen.getByRole('button', { name: /Book This Experience/i });
      expect(button).toBeDefined();
      expect(button.hasAttribute('disabled')).toBe(false);

      // Click the button and verify scroll
      fireEvent.click(button);
      expect(document.getElementById).toHaveBeenCalledWith('booking-widget');
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('does not show coming soon message', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={true}
        />
      );

      expect(screen.queryByText('Online booking coming soon!')).toBeNull();
    });

    it('does not show contact winery message', () => {
      renderWithI18n(
        <BookingCTA
          price={5000}
          experienceSlug="test-experience"
          stripeConnected={true}
        />
      );

      expect(
        screen.queryByText('Contact the winery directly to book this experience.')
      ).toBeNull();
    });
  });
});
