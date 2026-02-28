import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SearchableSelect from '../SearchableSelect.svelte';

describe('SearchableSelect', () => {
  it('renders with options and value', () => {
    const oncommit = vi.fn();
    const oncancel = vi.fn();
    render(SearchableSelect, {
      props: {
        options: ['A', 'B', 'C'],
        value: '',
        oncommit,
        oncancel,
      },
    });
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('calls oncommit with highlighted option on ArrowDown then Enter', async () => {
    const oncommit = vi.fn();
    const oncancel = vi.fn();
    render(SearchableSelect, {
      props: {
        options: ['A', 'B'],
        value: '',
        oncommit,
        oncancel,
      },
    });
    const input = screen.getByRole('combobox');
    input.focus();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(oncommit).toHaveBeenCalledWith('B');
  });

  it('calls oncancel on Escape', async () => {
    const oncommit = vi.fn();
    const oncancel = vi.fn();
    render(SearchableSelect, {
      props: {
        options: ['A', 'B'],
        value: 'A',
        oncommit,
        oncancel,
      },
    });
    const input = screen.getByRole('combobox');
    input.focus();
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  it('shows "No matches" when options empty and query does not allow custom', () => {
    const oncommit = vi.fn();
    const oncancel = vi.fn();
    render(SearchableSelect, {
      props: {
        options: [],
        value: '',
        oncommit,
        oncancel,
      },
    });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('shows "Use …" hint and commits custom value when allowCustom and value not in options', async () => {
    const oncommit = vi.fn();
    const oncancel = vi.fn();
    render(SearchableSelect, {
      props: {
        options: ['Running', 'Cycling'],
        value: '',
        allowCustom: true,
        oncommit,
        oncancel,
      },
    });
    const input = screen.getByRole('combobox');
    await fireEvent.input(input, { target: { value: 'Swimming' } });
    expect(screen.getByText(/Use .*Swimming/)).toBeInTheDocument();
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(oncommit).toHaveBeenCalledWith('Swimming');
  });

  it('calls oncancel when clicking outside', async () => {
    const oncommit = vi.fn();
    const oncancel = vi.fn();
    render(SearchableSelect, {
      props: {
        options: ['A', 'B'],
        value: 'A',
        oncommit,
        oncancel,
      },
    });
    await fireEvent.click(document.body);
    expect(oncancel).toHaveBeenCalledTimes(1);
  });
});
