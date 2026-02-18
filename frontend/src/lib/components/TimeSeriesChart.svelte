<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import type { StreamData } from '../types'
  import type { StreamConfig } from '../utils/stream-config'
  import { getStreamConfig } from '../utils/stream-config'

  interface Props {
    streamData: StreamData
    activityStartDate: number
    config?: StreamConfig
  }

  let { streamData, activityStartDate, config }: Props = $props()

  let containerEl: HTMLDivElement | null = $state(null)
  let chartInstance: uPlot | null = $state(null)
  let isZoomed = $state(false)

  function isDarkMode(): boolean {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  }

  const streamConfig = $derived(config ?? getStreamConfig(streamData.type))

  function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  function formatYValue(value: number): string {
    if (streamConfig.label === 'Heart Rate') return Math.round(value).toString()
    return value.toFixed(1)
  }

  // Build uPlot data [x[], y[]] and full x range for reset zoom
  const chartData = $derived.by(() => {
    if (!streamData.data?.length) return { data: null as uPlot.AlignedData | null, xMin: 0, xMax: 0, pointCount: 0 }
    const xs: number[] = []
    const ys: (number | null)[] = []
    for (const p of streamData.data) {
      const v = p.value
      if (typeof v !== 'number' || isNaN(v)) continue
      const elapsed = Math.max(0, p.time - activityStartDate)
      xs.push(elapsed)
      ys.push(v)
    }
    if (xs.length === 0) return { data: null, xMin: 0, xMax: 0, pointCount: 0 }
    const xMin = xs[0]
    const xMax = xs[xs.length - 1]
    return { data: [xs, ys] as uPlot.AlignedData, xMin, xMax, pointCount: xs.length }
  })

  export function resetZoom() {
    if (!chartInstance || !chartData.data) return
    const { xMin, xMax } = chartData
    chartInstance.batch(() => {
      chartInstance!.setScale('x', { min: xMin, max: xMax })
    })
    isZoomed = false
  }

  $effect(() => {
    if (!containerEl || !chartData.data || chartData.pointCount === 0) return

    const dark = isDarkMode()
    const textColor = dark ? '#d1d5db' : '#374151'
    const gridColor = dark ? '#374151' : '#e5e7eb'

    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }

    const { data, xMin, xMax } = chartData
    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: 256,
      series: [
        {},
        {
          label: streamConfig.label,
          stroke: streamConfig.color,
          width: 2,
          value: (_u, raw) => (raw == null ? '' : `${formatYValue(raw)}${streamConfig.unit ? ' ' + streamConfig.unit : ''}`),
        },
      ],
      scales: {
        x: { time: false, min: xMin, max: xMax },
        y: { auto: true },
      },
      axes: [
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => formatElapsedTime(t)),
          label: 'Elapsed Time',
          labelFont: '12px system-ui',
          font: '12px system-ui',
          size: 28,
          gap: 5,
          space: 40,
        },
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => (typeof t === 'number' ? formatYValue(t) : '')),
          label: streamConfig.label + (streamConfig.unit ? ` (${streamConfig.unit})` : ''),
          labelFont: '12px system-ui',
          font: '12px system-ui',
          size: 36,
          gap: 5,
          space: 50,
        },
      ],
      cursor: {
        show: true,
        x: true,
        y: true,
        drag: { setScale: true, x: true, y: false },
        points: { show: true, size: 4, stroke: streamConfig.color, width: 2 },
      },
      legend: { show: true, live: true },
      hooks: {
        setSelect: [
          (u) => {
            const xScale = u.scales.x
            if (!xScale || xScale.min == null || xScale.max == null) return
            const tol = (chartData.xMax - chartData.xMin) * 0.01
            isZoomed =
              Math.abs(xScale.min - chartData.xMin) > tol || Math.abs(xScale.max - chartData.xMax) > tol
          },
        ],
      },
    }

    chartInstance = new uPlot(opts, data, containerEl)

    // Track resize
    const ro = new ResizeObserver(() => {
      if (chartInstance && containerEl) {
        chartInstance.setSize({ width: containerEl.offsetWidth, height: 256 })
      }
    })
    ro.observe(containerEl)

    return () => {
      ro.disconnect()
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    }
  })
</script>

<div class="w-full animate-fade-in">
  {#if !streamData.data || streamData.data.length === 0}
    <div
      class="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400"
        >No data available for {streamConfig.label}</p
      >
    </div>
  {:else if chartData.pointCount === 0}
    <div
      class="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400">
        No valid numeric data for {streamConfig.label}
      </p>
    </div>
  {:else}
    <div class="relative">
      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-75 transition-opacity hover:opacity-100 dark:bg-gray-200 dark:text-gray-800"
        onclick={resetZoom}
        style="display: {isZoomed ? 'block' : 'none'};"
      >
        Reset Zoom
      </button>
      <div class="h-64 w-full" bind:this={containerEl}></div>
    </div>
  {/if}
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
  :global(.uplot .u-legend) {
    color: var(--uplot-text, #374151);
  }
</style>
