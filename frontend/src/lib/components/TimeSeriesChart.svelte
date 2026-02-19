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
  // Ref to avoid effect re-running when we assign chartInstance (effect must not read reactive chartInstance)
  const chartRef = { current: null as uPlot | null }

  const streamConfig = $derived(config ?? getStreamConfig(streamData.type))

  const smoothPath = uPlot.paths.spline()

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

    const textColor = '#d1d5db'
    const gridColor = 'rgba(255,255,255,0.12)'

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const { data, xMin, xMax } = chartData
    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: 384,
      series: [
        {},
        {
          label: streamConfig.label,
          stroke: streamConfig.color,
          width: 2,
          paths: smoothPath,
          fill: (u, seriesIdx) => {
            const s = u.series[seriesIdx]
            const scaleKey = (s.scale as string) || 'y'
            const sc = u.scales[scaleKey]
            if (!sc || sc.min == null || sc.max == null) return streamConfig.color + '40'
            const top = u.valToPos(sc.max, scaleKey, true)
            const bottom = u.valToPos(sc.min, scaleKey, true)
            const ctx = u.ctx
            if (!ctx) return streamConfig.color + '40'
            const grd = ctx.createLinearGradient(0, top, 0, bottom)
            grd.addColorStop(0, streamConfig.color + '40')
            grd.addColorStop(1, streamConfig.color + '00')
            return grd
          },
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
          labelFont: '13px system-ui',
          font: '13px system-ui',
          size: 40,
          gap: 8,
          space: 44,
        },
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => (typeof t === 'number' ? formatYValue(t) : '')),
          label: streamConfig.label + (streamConfig.unit ? ` (${streamConfig.unit})` : ''),
          labelFont: '13px system-ui',
          font: '13px system-ui',
          size: 36,
          gap: 5,
          space: 80,
          labelGap: 12,
          labelSize: 42,
        },
      ],
      cursor: {
        show: true,
        x: true,
        y: true,
        drag: { setScale: true, x: true, y: false },
        points: { show: true, size: 10, width: 2, stroke: '#ffffff', fill: streamConfig.color },
      },
      legend: { show: true, live: true },
      hooks: {
        setSelect: [
          (u) => {
            // Use setTimeout to avoid synchronous state updates during chart initialization
            setTimeout(() => {
              const xScale = u.scales.x
              if (!xScale || xScale.min == null || xScale.max == null) return
              const tol = (chartData.xMax - chartData.xMin) * 0.01
              isZoomed =
                Math.abs(xScale.min - chartData.xMin) > tol || Math.abs(xScale.max - chartData.xMax) > tol
            }, 0)
          },
        ],
      },
    }

    const u = new uPlot(opts, data, containerEl)
    chartRef.current = u
    chartInstance = u

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerEl) {
        chartRef.current.setSize({ width: containerEl.offsetWidth, height: 384 })
      }
    })
    ro.observe(containerEl)

    return () => {
      ro.disconnect()
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
      chartInstance = null
    }
  })
</script>

<div class="w-full animate-fade-in">
  {#if !streamData.data || streamData.data.length === 0}
    <div
      class="flex h-96 items-center justify-center rounded-lg border border-border bg-card"
    >
      <p class="text-sm text-text-secondary"
        >No data available for {streamConfig.label}</p
      >
    </div>
  {:else if chartData.pointCount === 0}
    <div
      class="flex h-96 items-center justify-center rounded-lg border border-border bg-card"
    >
      <p class="text-sm text-text-secondary">
        No valid numeric data for {streamConfig.label}
      </p>
    </div>
  {:else}
    <div class="relative pb-6">
      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary opacity-75 transition-opacity hover:opacity-100"
        onclick={resetZoom}
        style="display: {isZoomed ? 'block' : 'none'};"
      >
        Reset Zoom
      </button>
      <div class="h-96 w-full" bind:this={containerEl}></div>
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
    color: #9ca3af;
    margin-bottom: 0.75rem;
  }
  /* Hide the "Value: --" row (series 0) in live legend */
  :global(.uplot .u-legend tbody tr:first-child) {
    display: none;
  }
</style>
