import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExperienceDetails } from '@/components/features/experience/ExperienceDetails';

describe('ExperienceDetails', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders section title', () => {
    render(
      <ExperienceDetails
        description="Test description"
        duration={60}
        minCapacity={2}
        maxCapacity={10}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'About This Experience' })
    ).toBeDefined();
  });

  it('renders description', () => {
    const description =
      'A wonderful wine tasting experience in the heart of Valais.';
    render(
      <ExperienceDetails
        description={description}
        duration={60}
        minCapacity={2}
        maxCapacity={10}
      />
    );

    expect(screen.getByText(description)).toBeDefined();
  });

  it('formats duration under 60 minutes correctly', () => {
    render(
      <ExperienceDetails
        description="Test"
        duration={45}
        minCapacity={2}
        maxCapacity={10}
      />
    );

    expect(screen.getByText('45 min')).toBeDefined();
  });

  it('formats duration of exactly 1 hour correctly', () => {
    render(
      <ExperienceDetails
        description="Test"
        duration={60}
        minCapacity={2}
        maxCapacity={10}
      />
    );

    expect(screen.getByText('1h')).toBeDefined();
  });

  it('formats duration over 1 hour correctly', () => {
    render(
      <ExperienceDetails
        description="Test"
        duration={90}
        minCapacity={2}
        maxCapacity={10}
      />
    );

    expect(screen.getByText('1h 30min')).toBeDefined();
  });

  it('formats capacity range correctly', () => {
    render(
      <ExperienceDetails
        description="Test"
        duration={60}
        minCapacity={2}
        maxCapacity={10}
      />
    );

    expect(screen.getByText('2-10 people')).toBeDefined();
  });

  it('formats single capacity correctly', () => {
    render(
      <ExperienceDetails
        description="Test"
        duration={60}
        minCapacity={1}
        maxCapacity={1}
      />
    );

    expect(screen.getByText('1 person')).toBeDefined();
  });

  it('formats same min/max capacity correctly', () => {
    render(
      <ExperienceDetails
        description="Test"
        duration={60}
        minCapacity={6}
        maxCapacity={6}
      />
    );

    expect(screen.getByText('6 people')).toBeDefined();
  });
});
