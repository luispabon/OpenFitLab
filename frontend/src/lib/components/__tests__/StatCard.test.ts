import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatCard from '../StatCard.svelte';

describe('StatCard', () => {
  it('renders label and value for known stat type', () => {
    render(StatCard, {
      props: { statType: 'Duration', value: '08:08', unit: '' },
    });
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('08:08')).toBeInTheDocument();
  });

  it('renders unit when provided', () => {
    render(StatCard, {
      props: {
        statType: 'Average Heart Rate',
        value: '145',
        unit: 'bpm',
      },
    });
    expect(screen.getByText(/145/)).toBeInTheDocument();
    expect(screen.getByText(/bpm/)).toBeInTheDocument();
  });

  it('renders icon for known stat type', () => {
    const { container } = render(StatCard, {
      props: { statType: 'Distance', value: '5km', unit: '' },
    });
    const iconSpan = container.querySelector('.material-icons');
    expect(iconSpan).toBeInTheDocument();
  });

  it('renders nothing when stat type has no icon', () => {
    render(StatCard, {
      props: { statType: 'Banana', value: '42', unit: '' },
    });
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });
});
