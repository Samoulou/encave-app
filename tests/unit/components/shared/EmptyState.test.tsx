import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/shared/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);

    expect(screen.getByText('No items found')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="No items found"
        description="Try adjusting your filters"
      />
    );

    expect(screen.getByText('Try adjusting your filters')).toBeDefined();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="No items found" />);

    const description = screen.queryByText('Try adjusting');
    expect(description).toBeNull();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="No items"
        icon={<svg data-testid="custom-icon" />}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeDefined();
  });
});
