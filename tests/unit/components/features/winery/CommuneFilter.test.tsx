import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock nuqs
const mockSetCommune = vi.fn();
vi.mock('nuqs', () => ({
  useQueryState: vi.fn(() => [null, mockSetCommune]),
}));

import { useQueryState } from 'nuqs';
import { CommuneFilter } from '@/components/features/winery/CommuneFilter';

const mockCommunes = ['Sion', 'Sierre', 'Martigny'];

describe('CommuneFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryState).mockReturnValue([null, mockSetCommune]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with combobox role', () => {
    render(<CommuneFilter communes={mockCommunes} />);

    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('renders all commune options when opened', async () => {
    render(<CommuneFilter communes={mockCommunes} />);

    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Check that all communes are rendered
    expect(screen.getByRole('option', { name: 'Sion' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Sierre' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Martigny' })).toBeDefined();
  });

  it('renders "All communes" option', async () => {
    render(<CommuneFilter communes={mockCommunes} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(screen.getByRole('option', { name: 'All communes' })).toBeDefined();
  });

  it('calls setCommune with commune value when selected', async () => {
    render(<CommuneFilter communes={mockCommunes} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const sionOption = screen.getByRole('option', { name: 'Sion' });
    fireEvent.click(sionOption);

    expect(mockSetCommune).toHaveBeenCalledWith('Sion');
  });

  it('calls setCommune with null when "All communes" is selected', async () => {
    vi.mocked(useQueryState).mockReturnValue(['Sion', mockSetCommune]);
    render(<CommuneFilter communes={mockCommunes} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Find and click "All communes" option
    const allOption = screen.getByRole('option', { name: 'All communes' });
    fireEvent.click(allOption);

    expect(mockSetCommune).toHaveBeenCalledWith(null);
  });

  it('displays current commune selection from URL state', () => {
    vi.mocked(useQueryState).mockReturnValue(['Sierre', mockSetCommune]);
    render(<CommuneFilter communes={mockCommunes} />);

    // The selected value should be shown in the trigger
    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('Sierre');
  });

  it('handles empty communes list', () => {
    render(<CommuneFilter communes={[]} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Should still have "All communes" option
    expect(screen.getByRole('option', { name: 'All communes' })).toBeDefined();
  });
});
