import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EventDetailMoreStats from '../EventDetailMoreStats.svelte';

const defaultGroupedSections = [
  {
    category: 'Speed',
    entries: [{ statType: 'Average Speed in Kilometers per Hour', value: '10', unit: 'km/h' }],
  },
];
const defaultKeyMetricTypes = new Set<string>(['Duration']);

describe('EventDetailMoreStats', () => {
  it('renders nothing when hasMoreStats is false', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: false,
        groupedSections: defaultGroupedSections,
        keyMetricTypes: defaultKeyMetricTypes,
        onToggle: () => {},
      },
    });
    expect(screen.queryByText(/More stats/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /More stats/ })).not.toBeInTheDocument();
  });

  it('renders More stats button when hasMoreStats is true', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        groupedSections: defaultGroupedSections,
        keyMetricTypes: defaultKeyMetricTypes,
        onToggle: () => {},
      },
    });
    expect(screen.getByRole('button', { name: /More stats/ })).toBeInTheDocument();
  });

  it('calls onToggle when More stats button is clicked', async () => {
    const onToggle = vi.fn();
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        groupedSections: defaultGroupedSections,
        keyMetricTypes: defaultKeyMetricTypes,
        onToggle,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: /More stats/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('button has aria-expanded false when open is false', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        open: false,
        groupedSections: defaultGroupedSections,
        keyMetricTypes: defaultKeyMetricTypes,
        onToggle: () => {},
      },
    });
    const button = screen.getByRole('button', { name: /More stats/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('button has aria-expanded true when open is true', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        open: true,
        groupedSections: defaultGroupedSections,
        keyMetricTypes: defaultKeyMetricTypes,
        onToggle: () => {},
      },
    });
    const button = screen.getByRole('button', { name: /More stats/ });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('when open, shows section heading and non-key-metric entries', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        open: true,
        groupedSections: [
          {
            category: 'Speed',
            entries: [
              { statType: 'Average Speed in Kilometers per Hour', value: '20', unit: 'km/h' },
            ],
          },
        ],
        keyMetricTypes: new Set(['Duration']),
        onToggle: () => {},
      },
    });
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText(/20km\/h/)).toBeInTheDocument();
  });

  it('filters out entries whose statType is in keyMetricTypes', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        open: true,
        groupedSections: [
          {
            category: 'Time',
            entries: [
              { statType: 'Duration', value: '1:00:00', unit: '' },
              { statType: 'Distance', value: '5km', unit: '' },
            ],
          },
        ],
        keyMetricTypes: new Set(['Duration']),
        onToggle: () => {},
      },
    });
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('5km')).toBeInTheDocument();
    expect(screen.queryByText('1:00:00')).not.toBeInTheDocument();
  });

  it('omits sections that have no entries after filtering', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        open: true,
        groupedSections: [
          {
            category: 'Heart Rate',
            entries: [{ statType: 'Average Heart Rate', value: '140', unit: 'bpm' }],
          },
        ],
        keyMetricTypes: new Set(['Average Heart Rate']),
        onToggle: () => {},
      },
    });
    expect(screen.queryByText('Heart Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('140')).not.toBeInTheDocument();
  });

  it('renders multiple sections with correct headings and entries', () => {
    render(EventDetailMoreStats, {
      props: {
        hasMoreStats: true,
        open: true,
        groupedSections: [
          { category: 'Distance', entries: [{ statType: 'Distance', value: '10km', unit: '' }] },
          {
            category: 'Speed',
            entries: [
              { statType: 'Average Speed in Kilometers per Hour', value: '12', unit: 'km/h' },
            ],
          },
        ],
        keyMetricTypes: new Set<string>(),
        onToggle: () => {},
      },
    });
    expect(screen.getByRole('heading', { name: 'Distance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Speed' })).toBeInTheDocument();
    expect(screen.getByText('10km')).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });
});
