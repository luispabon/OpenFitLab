import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import DashboardPaginationWithUrl from '../DashboardPaginationWithUrl.svelte';

let initialQuerystring = '';
const mockPush = vi.fn();

vi.mock('svelte-spa-router', () => ({
  push: (...args: unknown[]) => mockPush(...args),
  querystring: {
    subscribe(fn: (v: string) => void) {
      fn(initialQuerystring);
      return { unsubscribe: () => {} };
    },
  },
}));

describe('DashboardPaginationWithUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialQuerystring = '';
  });

  it('syncs page and pageSize from URL on mount', async () => {
    initialQuerystring = 'page=2&pageSize=30';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      const page2Buttons = screen.getAllByRole('button', { name: 'Page 2' });
      expect(page2Buttons[0]).toHaveAttribute('aria-current', 'page');
    });
    const perPageSelects = screen.getAllByRole('combobox', { name: /per page/i });
    await waitFor(() => {
      expect(perPageSelects[0]).toHaveValue('30');
    });
  });

  it('includes pageSize in push when not default (20)', async () => {
    initialQuerystring = 'page=1&pageSize=50';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Page 1' })[0]).toBeInTheDocument();
    });
    await fireEvent.click(screen.getAllByRole('button', { name: 'Page 2' })[0]);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=2'));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('pageSize=50'));
    });
  });

  it('calls push when page changes via paginator', async () => {
    initialQuerystring = 'page=1';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Page 1' })[0]).toBeInTheDocument();
    });
    await fireEvent.click(screen.getAllByRole('button', { name: 'Page 2' })[0]);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\?page=2/));
    });
  });

  it('corrects page to totalPages when URL page exceeds total pages', async () => {
    initialQuerystring = 'page=5';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 10 },
    });
    await waitFor(() => {
      expect(screen.getAllByText('1-10 of 10').length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole('combobox', { name: 'Page 1 of 1' }).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders visible page numbers from derived state', async () => {
    initialQuerystring = 'page=3';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Page 3' })[0]).toHaveAttribute(
        'aria-current',
        'page'
      );
    });
    expect(screen.getAllByRole('button', { name: 'Page 1' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Page 5' })[0]).toBeInTheDocument();
  });

  it('updates pageSize and resets to page 1 when per-page select changes', async () => {
    initialQuerystring = 'page=3&pageSize=20';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Page 3' })[0]).toBeInTheDocument();
    });
    const perPageSelect = screen.getAllByRole('combobox', { name: /per page/i })[0];
    await fireEvent.change(perPageSelect, { target: { value: '50' } });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('pageSize=50'));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=1'));
    });
  });

  it('falls back to pageSize 20 when URL has invalid pageSize', async () => {
    initialQuerystring = 'page=1&pageSize=99';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      const perPageSelects = screen.getAllByRole('combobox', { name: /per page/i });
      expect(perPageSelects[0]).toHaveValue('20');
    });
  });

  it('shows page range text "21-40 of 50" when page 2 and pageSize 20', async () => {
    initialQuerystring = 'page=2&pageSize=20';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 50 },
    });
    await waitFor(() => {
      expect(screen.getAllByText('21-40 of 50').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not push when URL already matches page and pageSize', async () => {
    initialQuerystring = 'page=2&pageSize=20';
    mockPush.mockClear();
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Page 2' })[0]).toHaveAttribute(
        'aria-current',
        'page'
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls push with page=3 when Page 3 button clicked', async () => {
    initialQuerystring = 'page=1&pageSize=20';
    render(DashboardPaginationWithUrl, {
      props: { totalRows: 100 },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Page 1' })[0]).toBeInTheDocument();
    });
    await fireEvent.click(screen.getAllByRole('button', { name: 'Page 3' })[0]);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/page=3/));
    });
  });
});
