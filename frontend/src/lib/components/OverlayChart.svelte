<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import type { StreamData } from '../types'
  import { getStreamConfig } from '../utils/stream-config'

  interface Props {
    streams: StreamData[]
    activityStartDate: number
  }

  let { streams, activityStartDate }: Props = $props()

  let containerEl: HTMLDivElement | null = $state(null)
  let chartInstance: uPlot | null = $state(null)
  let isZoomed = $state(false)
  const chartRef = { current: null as uPlot | null }

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

  function formatYValue(value: number, label: string): string {
    if (label === 'Heart Rate') return Math.round(value).toString()
    return value.toFixed(1)
  }

  // Build aligned data: one x array (sorted union of all x) and one y array per stream (value or null)
  const chartData = $derived.by(() => {
    const withPoints: { stream: StreamData; pts: { x: number; y: number }[] }[] = []
    for (const stream of streams) {
      if (!stream.data?.length) continue
      const pts: { x: number; y: number }[] = []
      for (const p of stream.data) {
        const v = p.value
        if (typeof v !== 'number' || isNaN(v)) continue
        pts.push({ x: Math.max(0, p.time - activityStartDate), y: v })
      }
      if (pts.length > 0) withPoints.push({ stream, pts })
    }
    if (withPoints.length === 0) return { data: null as uPlot.AlignedData | null, xMin: 0, xMax: 0, configs: [] }

    const xSet = new Set<number>()
    for (const { pts } of withPoints) {
      for (const p of pts) xSet.add(p.x)
    }
    const xSorted = Array.from(xSet).sort((a, b) => a - b)
    if (xSorted.length === 0) return { data: null, xMin: 0, xMax: 0, configs: [] }

    const configs = withPoints.map(({ stream }) => getStreamConfig(stream.type))
    const yArrays: (number | null)[][] = []
    for (const { pts } of withPoints) {
      const byX = new Map(pts.map((p) => [p.x, p.y]))
      yArrays.push(xSorted.map((x) => byX.get(x) ?? null))
    }
    const data: uPlot.AlignedData = [xSorted, ...yArrays]
    const xMin = xSorted[0]
    const xMax = xSorted[xSorted.length - 1]
    return { data, xMin, xMax, configs }
  })

  function resetZoom() {
    if (!chartInstance || !chartData.data) return
    const { xMin, xMax } = chartData
    chartInstance.batch(() => {
      chartInstance!.setScale('x', { min: xMin, max: xMax })
    })
    isZoomed = false
  }

  function getYScaleKey(index: number, total: number): string {
    if (total <= 1) return 'y'
    return index % 2 === 0 ? 'y' : 'y1'
  }

  const smoothPath = uPlot.paths.spline()

  $effect(() => {
    if (!containerEl || !chartData.data || chartData.configs.length === 0) return

    const textColor = '#d1d5db'
    const gridColor = 'rgba(255,255,255,0.12)'

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const { data, xMin, xMax, configs } = chartData
    const nSeries = configs.length

    const series: uPlot.Series[] = [{}]
    for (let i = 0; i < nSeries; i++) {
      const cfg = configs[i]
      const scaleKey = getYScaleKey(i, nSeries)
      series.push({
        label: cfg.label,
        stroke: cfg.color,
        width: 2,
        scale: scaleKey,
        paths: smoothPath,
        fill: (u, seriesIdx) => {
          const s = u.series[seriesIdx]
          const sk = (s.scale as string) || 'y'
          const sc = u.scales[sk]
          if (!sc || sc.min == null || sc.max == null) return cfg.color + '30'
          const top = u.valToPos(sc.max, sk, true)
          const bottom = u.valToPos(sc.min, sk, true)
          const ctx = u.ctx
          if (!ctx) return cfg.color + '30'
          const grd = ctx.createLinearGradient(0, top, 0, bottom)
          grd.addColorStop(0, cfg.color + '30')
          grd.addColorStop(1, cfg.color + '00')
          return grd
        },
        value: (_u, raw) =>
          raw == null ? '' : `${formatYValue(raw, cfg.label)}${cfg.unit ? ' ' + cfg.unit : ''}`,
      })
    }

    const scales: uPlot.Scales = {
      x: { time: false, min: xMin, max: xMax },
      y: { auto: true },
      y1: { auto: true },
    }

    const axes: uPlot.Axis[] = [
      {
        stroke: textColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: textColor },
        values: (_u, ticks) => ticks.map((t) => formatElapsedTime(t)),
        label: 'Elapsed Time',
        labelFont: '13px system-ui',
        font: '13px system-ui',
        size: 28,
        gap: 5,
        space: 40,
      },
    ]

    const leftConfig = configs[0]
    const rightConfig = configs.length > 1 ? configs[1] : null
    axes.push({
      scale: 'y',
      stroke: textColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { stroke: textColor },
      values: (_u, ticks) =>
        ticks.map((t) => (typeof t === 'number' ? formatYValue(t, leftConfig.label) : '')),
      label: leftConfig.label + (leftConfig.unit ? ` (${leftConfig.unit})` : ''),
      labelFont: '13px system-ui',
      font: '13px system-ui',
      size: 36,
      gap: 5,
      space: 50,
      side: 3,
    })
    if (rightConfig) {
      axes.push({
        scale: 'y1',
        stroke: textColor,
        grid: { show: false },
        ticks: { stroke: textColor },
        values: (_u, ticks) =>
          ticks.map((t) => (typeof t === 'number' ? formatYValue(t, rightConfig.label) : '')),
        label: rightConfig.label + (rightConfig.unit ? ` (${rightConfig.unit})` : ''),
        labelFont: '13px system-ui',
        font: '13px system-ui',
        size: 36,
        gap: 5,
        space: 50,
        side: 1,
      })
    }

    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: 256,
      series,
      scales,
      axes,
      cursor: {
        show: true,
        x: true,
        y: true,
        drag: { setScale: true, x: true, y: false },
        points: { show: true, size: 4, width: 2 },
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
        chartRef.current.setSize({ width: containerEl.offsetWidth, height: 256 })
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
  {#if streams.length === 0 || !chartData.data}
    <div
      class="flex h-64 items-center justify-center rounded-lg border border-border bg-card"
    >
      <p class="text-sm text-text-secondary">No data available</p>
    </div>
  {:else}
    <div class="relative">
      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary opacity-75 transition-opacity hover:opacity-100"
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
    color: #9ca3af;
  }
</style>
