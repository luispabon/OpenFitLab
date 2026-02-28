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

  it('calls goToPage(1) when Previous page clicked and current page is 2', async () => {
    const goToPage = vi.fn();
    render(DashboardPaginator, {
      props: {
        ...defaultProps,
        currentPageFromUrl: 2,
        goToPage,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(goToPage).toHaveBeenCalledWith(1);
  });

  it('calls goToPage(5) when Next page clicked and current page is 4', async () => {
    const goToPage = vi.fn();
    render(DashboardPaginator, {
      props: {
        ...defaultProps,
        currentPageFromUrl: 4,
        totalPages: 5,
        visiblePageNumbers: [1, 3, 4, 5],
        pageRangeText: '61-80 of 100',
        goToPage,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(goToPage).toHaveBeenCalledWith(5);
  });

  it('shows ellipsis between non-adjacent page numbers', () => {
    render(DashboardPaginator, {
      props: {
        ...defaultProps,
        visiblePageNumbers: [1, 3, 4, 5],
        currentPageFromUrl: 3,
      },
    });
    const ellipsis = screen.getByText('…');
    expect(ellipsis).toBeInTheDocument();
  });

  it('calls goToPage when jump-to-page select is changed', async () => {
    const goToPage = vi.fn();
    render(DashboardPaginator, {
      props: {
        ...defaultProps,
        currentPageFromUrl: 2,
        totalPages: 5,
        goToPage,
      },
    });
    const jumpSelect = screen.getByRole('combobox', { name: /page 2 of 5/i });
    await fireEvent.change(jumpSelect, { target: { value: '4' } });
    expect(goToPage).toHaveBeenCalledWith(4);
  });
});
