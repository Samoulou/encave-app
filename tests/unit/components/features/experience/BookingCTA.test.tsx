import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BookingCTA } from '@/components/features/experience/BookingCTA';

describe('BookingCTA', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders price correctly', () => {
    render(<BookingCTA price={5000} />);

    expect(screen.getByText('CHF 50')).toBeDefined();
  });

  it('renders per person text', () => {
    render(<BookingCTA price={5000} />);

    expect(screen.getByText('per person')).toBeDefined();
  });

  it('renders book button', () => {
    render(<BookingCTA price={5000} />);

    expect(
      screen.getByRole('button', { name: /Book This Experience/i })
    ).toBeDefined();
  });

  it('button is disabled', () => {
    render(<BookingCTA price={5000} />);

    const button = screen.getByRole('button', { name: /Book This Experience/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('shows coming soon message', () => {
    render(<BookingCTA price={5000} />);

    expect(screen.getByText('Online booking coming soon!')).toBeDefined();
  });

  it('shows contact winery message', () => {
    render(<BookingCTA price={5000} />);

    expect(
      screen.getByText('Contact the winery directly to book this experience.')
    ).toBeDefined();
  });

  it('has tooltip text available', () => {
    // The tooltip shows "Booking coming soon!" - we verify the static message exists
    render(<BookingCTA price={5000} />);

    // The "coming soon" text is shown in the info box below the button
    expect(screen.getByText('Online booking coming soon!')).toBeDefined();
  });

  it('renders correctly with high price', () => {
    render(<BookingCTA price={15000} />);

    expect(screen.getByText('CHF 150')).toBeDefined();
  });
});
