import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import EventExportDropdown from '../EventExportDropdown.svelte';

const mockDownloadEventTcx = vi.fn();
const mockDownloadEventGpx = vi.fn();

vi.mock('../../api/export', () => ({
  downloadEventTcx: (...args: unknown[]) => mockDownloadEventTcx(...args),
  downloadEventGpx: (...args: unknown[]) => mockDownloadEventGpx(...args),
}));

const defaultProps = {
  eventId: 'evt-1',
  eventName: 'Morning Run',
  hasGps: true,
};

beforeEach(() => {
  mockDownloadEventTcx.mockReset().mockResolvedValue(undefined);
  mockDownloadEventGpx.mockReset().mockResolvedValue(undefined);
});

describe('EventExportDropdown', () => {
  it('renders Export button', () => {
    render(EventExportDropdown, { props: defaultProps });
    expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
  });

  it('clicking button opens the dropdown', async () => {
    render(EventExportDropdown, { props: defaultProps });
    const button = screen.getByRole('button', { name: /Export/i });

    expect(screen.queryByText('Download TCX')).not.toBeInTheDocument();
    await fireEvent.click(button);
    expect(screen.getByText('Download TCX')).toBeInTheDocument();
  });

  it('"Download TCX" item always rendered when dropdown is open', async () => {
    render(EventExportDropdown, { props: { ...defaultProps, hasGps: false } });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(screen.getByText('Download TCX')).toBeInTheDocument();
  });

  it('"Download GPX" item rendered when hasGps=true', async () => {
    render(EventExportDropdown, { props: { ...defaultProps, hasGps: true } });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(screen.getByText('Download GPX')).toBeInTheDocument();
  });

  it('"Download GPX" item not rendered when hasGps=false', async () => {
    render(EventExportDropdown, { props: { ...defaultProps, hasGps: false } });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(screen.queryByText('Download GPX')).not.toBeInTheDocument();
  });

  it('clicking "Download TCX" calls downloadEventTcx with correct args', async () => {
    render(EventExportDropdown, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    await fireEvent.click(screen.getByText('Download TCX'));
    expect(mockDownloadEventTcx).toHaveBeenCalledWith('evt-1', 'Morning Run');
  });

  it('clicking "Download GPX" calls downloadEventGpx with correct args', async () => {
    render(EventExportDropdown, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    await fireEvent.click(screen.getByText('Download GPX'));
    expect(mockDownloadEventGpx).toHaveBeenCalledWith('evt-1', 'Morning Run');
  });

  it('shows error message when download throws', async () => {
    mockDownloadEventTcx.mockRejectedValue(new Error('TCX export failed: Not Found'));
    render(EventExportDropdown, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    await fireEvent.click(screen.getByText('Download TCX'));
    await waitFor(() => {
      expect(screen.getByText('TCX export failed: Not Found')).toBeInTheDocument();
    });
  });

  it('dropdown closes after selecting an item', async () => {
    render(EventExportDropdown, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(screen.getByText('Download TCX')).toBeInTheDocument();
    await fireEvent.click(screen.getByText('Download TCX'));
    // Dropdown should be closed (Download TCX no longer in DOM)
    await waitFor(() => {
      expect(screen.queryByText('Download TCX')).not.toBeInTheDocument();
    });
  });

  it('Escape key closes the dropdown', async () => {
    const { container } = render(EventExportDropdown, { props: defaultProps });
    await fireEvent.click(screen.getByRole('button', { name: /Export/i }));
    expect(screen.getByText('Download TCX')).toBeInTheDocument();

    const wrapper = container.querySelector('[data-export-exclude]') as HTMLElement;
    await fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.queryByText('Download TCX')).not.toBeInTheDocument();
  });

  it('has data-export-exclude attribute so PNG export ignores it', () => {
    const { container } = render(EventExportDropdown, { props: defaultProps });
    expect(container.querySelector('[data-export-exclude]')).toBeInTheDocument();
  });
});
