import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import DeltaChart from '../DeltaChart.svelte';

vi.mock('uplot', () => {
  const instance = {
    destroy: vi.fn(),
    setSize: vi.fn(),
    ctx: {
      save: vi.fn(),
      restore: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    },
    valToPos: vi.fn(() => 100),
    bbox: { left: 0, width: 200, top: 0, height: 200 },
  };
  (globalThis as { __deltaChartMock?: { instance: typeof instance } }).__deltaChartMock = {
    instance,
  };
  const Mock = vi.fn(function (this: unknown) {
    return instance;
  });
  (Mock as unknown as { paths: Record<string, () => () => void> }).paths = {
    spline: () => () => {},
    linear: () => () => {},
  };
  return { default: Mock };
});

function getMock() {
  return (globalThis as { __deltaChartMock?: { instance: { destroy: ReturnType<typeof vi.fn> } } })
    .__deltaChartMock!;
}

describe('DeltaChart', () => {
  it('renders "No delta data" when deltaSeries is empty', () => {
    render(DeltaChart, {
      props: {
        deltaSeries: [],
        label: 'Heart Rate delta',
        color: '#3b82f6',
        unit: 'bpm',
      },
    });
    expect(screen.getByText(/No delta data/)).toBeInTheDocument();
  });

  it('renders chart container when deltaSeries has data', async () => {
    render(DeltaChart, {
      props: {
        deltaSeries: [
          { x: 0, y: 2 },
          { x: 1000, y: -3 },
        ],
        label: 'Heart Rate delta',
        color: '#3b82f6',
        unit: 'bpm',
      },
    });
    await tick();
    expect(screen.queryByText(/No delta data/)).not.toBeInTheDocument();
  });

  it('destroys chart on unmount', async () => {
    const { unmount } = render(DeltaChart, {
      props: {
        deltaSeries: [{ x: 0, y: 1 }],
        label: 'HR delta',
        color: '#3b82f6',
        unit: 'bpm',
      },
    });
    await tick();
    unmount();
    expect(getMock().instance.destroy).toHaveBeenCalled();
  });
});
