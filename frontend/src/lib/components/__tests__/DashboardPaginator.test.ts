import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DashboardPaginator from '../dashboard/DashboardPaginator.svelte';

describe('DashboardPaginator', () => {
  const defaultProps = {
    totalRows: 100,
    pageSize: 20,
    totalPages: 5,
    currentPageFromUrl: 1,
    visiblePageNumbers: [1, 2, 3, 4, 5],
    pageRangeText: '1-20 of 100',
    onPageSizeChange: () => {},
    goToPage: () => {},
  };

  it('renders nothing when totalRows is 0', () => {
    const { container } = render(DashboardPaginator, {
      props: {
        ...defaultProps,
        totalRows: 0,
        totalPages: 0,
        visiblePageNumbers: [],
        pageRangeText: '0 of 0',
      },
    });
    expect(container.querySelector('select')).toBeNull();
  });

  it('shows page range text', () => {
    render(DashboardPaginator, { props: defaultProps });
    expect(screen.getByText('1-20 of 100')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(DashboardPaginator, { props: defaultProps });
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(DashboardPaginator, {
      props: {
        ...defaultProps,
        currentPageFromUrl: 5,
      },
    });
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('calls goToPage when page button clicked', async () => {
    const goToPage = vi.fn();
    render(DashboardPaginator, {
      props: { ...defaultProps, goToPage },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(goToPage).toHaveBeenCalledWith(2);
  });

  it('current page button has aria-current="page"', () => {
    render(DashboardPaginator, {
      props: { ...defaultProps, currentPageFromUrl: 3 },
    });
    const page3 = screen.getByRole('button', { name: 'Page 3' });
    expect(page3).toHaveAttribute('aria-current', 'page');
  });

  it('shows page size options 20, 30, 40, 50', () => {
    render(DashboardPaginator, { props: defaultProps });
    const select = screen.getByRole('combobox', { name: /per page/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '20' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '50' })).toBeInTheDocument();
  });
});
