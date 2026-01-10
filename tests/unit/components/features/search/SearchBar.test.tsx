import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '@/components/features/search/SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders with placeholder text', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(
      screen.getByPlaceholderText('Search experiences, wineries...')
    ).toBeDefined();
  });

  it('renders with custom placeholder', () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        placeholder="Custom placeholder"
      />
    );
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeDefined();
  });

  it('displays the current value', () => {
    render(<SearchBar value="wine" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('wine');
  });

  it('shows clear button when value is present', () => {
    render(<SearchBar value="wine" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear search/i })).toBeDefined();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });

  it('clears value when clear button is clicked', async () => {
    const onChange = vi.fn();
    render(<SearchBar value="wine" onChange={onChange} />);

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('debounces onChange callback', async () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'w' } });
    fireEvent.change(input, { target: { value: 'wi' } });
    fireEvent.change(input, { target: { value: 'win' } });

    // Should not have called onChange yet
    expect(onChange).not.toHaveBeenCalled();

    // Fast forward debounce timer
    vi.advanceTimersByTime(300);

    // Now it should have been called with final value
    expect(onChange).toHaveBeenCalledWith('win');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('has proper aria-label for accessibility', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /search experiences/i })).toBeDefined();
  });
});
