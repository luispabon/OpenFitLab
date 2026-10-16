import { vi } from 'vitest';

/**
 * Test-only Chart.js mock. Use from a test file with:
 *   vi.mock('chart.js', async () => (await import('<relative>/test/chartjs-mock')).chartJsModuleMock());
 *   vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));
 */

export interface MockDataPoint {
  x: number;
  y: number | null;
}

export interface MockDataset {
  label: string;
  data: MockDataPoint[];
  yAxisID?: string;
  fill?: unknown;
  showLine?: boolean;
  borderColor?: unknown;
  backgroundColor?: unknown;
}

export interface MockScale {
  type?: string;
  position?: string;
  min?: number;
  max?: number;
  ticks?: { color?: string; callback?: (value: number | string) => string };
  title?: { text?: string };
}

export interface MockTooltipItem {
  datasetIndex: number;
  dataset: { label?: string };
  parsed: { x: number; y: number };
}

export interface MockChartInstance {
  config: MockChartConfig;
  destroy: ReturnType<typeof vi.fn>;
  resetZoom: ReturnType<typeof vi.fn>;
  isZoomedOrPanned: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

export interface MockChartOptions {
  interaction?: { mode: string; intersect: boolean };
  transitions?: { zoom?: { animation?: { duration?: number } } };
  scales: Record<string, MockScale>;
  plugins: {
    legend?: unknown;
    tooltip?: {
      filter?: (item: MockTooltipItem, index: number, items: MockTooltipItem[]) => boolean;
      callbacks?: {
        title?: (items: MockTooltipItem[]) => string;
        label?: (item: MockTooltipItem) => string;
      };
    };
    zoom?: {
      zoom: {
        mode: string;
        drag: unknown;
        onZoomComplete?: (ctx: { chart: MockChartInstance }) => void;
      };
    };
  };
}

export interface MockChartConfig {
  type: string;
  data: { datasets: MockDataset[] };
  options: MockChartOptions;
  plugins?: { id?: string }[];
}

/** Configs and instances in creation order. Cleared by resetChartMock(). */
export const chartRegistry = {
  configs: [] as MockChartConfig[],
  instances: [] as MockChartInstance[],
  registered: [] as unknown[],
};

/** Inert stand-ins for the Chart.js registrables imported by chart-utils.ts. */
export const chartJsRegistrables = {
  Filler: Symbol('Filler'),
  Legend: Symbol('Legend'),
  LinearScale: Symbol('LinearScale'),
  LineController: Symbol('LineController'),
  LineElement: Symbol('LineElement'),
  LogarithmicScale: Symbol('LogarithmicScale'),
  PointElement: Symbol('PointElement'),
  ScatterController: Symbol('ScatterController'),
  Tooltip: Symbol('Tooltip'),
};

class MockChart {
  static register = (...items: unknown[]) => {
    chartRegistry.registered.push(...items);
  };
  static defaults = { plugins: { tooltip: { caretPadding: 0 } } };

  constructor(_canvas: HTMLCanvasElement, config: MockChartConfig) {
    const instance: MockChartInstance = {
      config,
      destroy: vi.fn(),
      resetZoom: vi.fn(),
      isZoomedOrPanned: vi.fn(() => false),
      update: vi.fn(),
    };
    chartRegistry.configs.push(config);
    chartRegistry.instances.push(instance);
    return instance as unknown as MockChart;
  }
}

/** Module object for `vi.mock('chart.js', ...)`. */
export function chartJsModuleMock() {
  return { Chart: MockChart, ...chartJsRegistrables };
}

export function resetChartMock(): void {
  chartRegistry.configs.length = 0;
  chartRegistry.instances.length = 0;
  chartRegistry.registered.length = 0;
}

export function getLastChartConfig(): MockChartConfig {
  const config = chartRegistry.configs.at(-1);
  if (!config) throw new Error('No Chart.js chart was created');
  return config;
}

export function getLastChartInstance(): MockChartInstance {
  const instance = chartRegistry.instances.at(-1);
  if (!instance) throw new Error('No Chart.js chart was created');
  return instance;
}
