<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import type { StreamData } from '../types'
  import { getStreamConfig } from '../utils/stream-config'

  interface ComparisonEntry {
    eventName: string
    color: string
    data: StreamData
    activityStartDate: number
  }

  interface Props {
    streamType: string
    entries: ComparisonEntry[]
    xAxisMode: 'elapsed' | 'wall-clock'
  }

  let { streamType, entries, xAxisMode }: Props = $props()

  let containerEl: HTMLDivElement | null = $state(null)
  let chartInstance: uPlot | null = $state(null)
  let isZoomed = $state(false)
  const chartRef = { current: null as uPlot | null }

  const streamConfig = $derived(getStreamConfig(streamType))

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

  function formatWallClockTime(ms: number): string {
    const date = new Date(ms)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  function formatYValue(value: number): string {
    if (streamType === 'Heart Rate') return Math.round(value).toString()
    return value.toFixed(1)
  }

  // Build aligned data: merge X values from all events, create Y arrays per event
  const chartData = $derived.by(() => {
    const withPoints: { entry: ComparisonEntry; pts: { x: number; y: number }[] }[] = []
    
    for (const entry of entries) {
      if (!entry.data?.data?.length) continue
      const pts: { x: number; y: number }[] = []
      for (const p of entry.data.data) {
        const v = p.value
        if (typeof v !== 'number' || isNaN(v)) continue
        
        // X-axis: elapsed (relative) or wall-clock (absolute)
        const x = xAxisMode === 'elapsed' 
          ? Math.max(0, p.time - entry.activityStartDate)
          : p.time
        
        pts.push({ x, y: v })
      }
      if (pts.length > 0) withPoints.push({ entry, pts })
    }
    
    if (withPoints.length === 0) {
      return { data: null as uPlot.AlignedData | null, xMin: 0, xMax: 0 }
    }

    // Merge all X values into sorted union
    const xSet = new Set<number>()
    for (const { pts } of withPoints) {
      for (const p of pts) xSet.add(p.x)
    }
    const xSorted = Array.from(xSet).sort((a, b) => a - b)
    if (xSorted.length === 0) return { data: null, xMin: 0, xMax: 0 }

    // Create Y arrays: one per event, aligned to union X array
    // For sparse data, use linear interpolation to fill gaps for better visualization
    const yArrays: (number | null)[][] = []
    const sparseFlags: boolean[] = [] // Track which series are sparse
    
    for (const { pts } of withPoints) {
      const byX = new Map(pts.map((p) => [p.x, p.y]))
      const sortedPts = [...pts].sort((a, b) => a.x - b.x)
      
      // If data is sparse (fewer than 30% of union points), use interpolation
      const isSparse = sortedPts.length < xSorted.length * 0.3 && sortedPts.length >= 2
      sparseFlags.push(isSparse)
      
      if (isSparse) {
        // Linear interpolation for sparse data
        const interpolated: (number | null)[] = []
        for (const x of xSorted) {
          const exact = byX.get(x)
          if (exact !== undefined) {
            interpolated.push(exact)
          } else {
            // Find surrounding points for interpolation
            let leftIdx = -1
            let rightIdx = sortedPts.length
            
            for (let i = 0; i < sortedPts.length; i++) {
              if (sortedPts[i].x < x) leftIdx = i
              else if (sortedPts[i].x > x && rightIdx === sortedPts.length) {
                rightIdx = i
                break
              }
            }
            
            if (leftIdx >= 0 && rightIdx < sortedPts.length) {
              // Linear interpolation between surrounding points
              const left = sortedPts[leftIdx]
              const right = sortedPts[rightIdx]
              const t = (x - left.x) / (right.x - left.x)
              const interpolatedValue = left.y + t * (right.y - left.y)
              interpolated.push(interpolatedValue)
            } else if (leftIdx >= 0) {
              // Extrapolate from last point (use last known value)
              interpolated.push(sortedPts[leftIdx].y)
            } else if (rightIdx < sortedPts.length) {
              // Extrapolate from first point (use first known value)
              interpolated.push(sortedPts[rightIdx].y)
            } else {
              interpolated.push(null)
            }
          }
        }
        yArrays.push(interpolated)
      } else {
        // Dense data: use exact matches only
        yArrays.push(xSorted.map((x) => byX.get(x) ?? null))
      }
    }
    
    const data: uPlot.AlignedData = [xSorted, ...yArrays]
    const xMin = xSorted[0]
    const xMax = xSorted[xSorted.length - 1]
    return { data, xMin, xMax, sparseFlags }
  })

  function resetZoom() {
    if (!chartInstance || !chartData.data) return
    const { xMin, xMax } = chartData
    chartInstance.batch(() => {
      chartInstance!.setScale('x', { min: xMin, max: xMax })
    })
    isZoomed = false
  }

  const smoothPath = uPlot.paths.spline()

  $effect(() => {
    if (!containerEl || !chartData.data || entries.length === 0) return

    const textColor = '#d1d5db'
    const gridColor = 'rgba(255,255,255,0.12)'

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const { data, xMin, xMax, sparseFlags } = chartData
    const nSeries = entries.length

    // Series: one per event, all share same Y-axis
    const series: uPlot.Series[] = [{}]
    for (let i = 0; i < nSeries; i++) {
      const entry = entries[i]
      const isSparse = sparseFlags[i] ?? false
      
      // Use linear paths for sparse data (better gap handling), spline for dense data
      const pathRenderer = isSparse ? uPlot.paths.linear() : smoothPath
      
      series.push({
        label: entry.eventName,
        stroke: entry.color,
        width: 2,
        scale: 'y',
        paths: pathRenderer,
        spanGaps: false, // Don't span gaps - show them explicitly
        fill: (u, seriesIdx) => {
          const s = u.series[seriesIdx]
          const sc = u.scales.y
          if (!sc || sc.min == null || sc.max == null) return entry.color + '30'
          const top = u.valToPos(sc.max, 'y', true)
          const bottom = u.valToPos(sc.min, 'y', true)
          const ctx = u.ctx
          if (!ctx) return entry.color + '30'
          const grd = ctx.createLinearGradient(0, top, 0, bottom)
          grd.addColorStop(0, entry.color + '30')
          grd.addColorStop(1, entry.color + '00')
          return grd
        },
        value: (_u, raw) =>
          raw == null ? '' : `${formatYValue(raw)}${streamConfig.unit ? ' ' + streamConfig.unit : ''}`,
      })
    }

    const scales: uPlot.Scales = {
      x: { time: false, min: xMin, max: xMax },
      y: { auto: true },
    }

    const axes: uPlot.Axis[] = [
      {
        stroke: textColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: textColor },
        values: (_u, ticks) =>
          ticks.map((t) =>
            xAxisMode === 'elapsed' ? formatElapsedTime(t) : formatWallClockTime(t)
          ),
        label: xAxisMode === 'elapsed' ? 'Elapsed Time' : 'Time',
        labelFont: '13px system-ui',
        font: '13px system-ui',
        size: 40,
        gap: 8,
        space: 44,
      },
      {
        scale: 'y',
        stroke: textColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: textColor },
        values: (_u, ticks) =>
          ticks.map((t) => (typeof t === 'number' ? formatYValue(t) : '')),
        label: streamConfig.label + (streamConfig.unit ? ` (${streamConfig.unit})` : ''),
        labelFont: '13px system-ui',
        font: '13px system-ui',
        size: 36,
        gap: 5,
        space: 80,
        labelGap: 12,
        labelSize: 42,
        side: 3,
      },
    ]

    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: 384,
      series,
      scales,
      axes,
      cursor: {
        show: true,
        x: true,
        y: true,
        drag: { setScale: true, x: true, y: false },
        focus: { prox: 30 },
        points: { one: true, show: true, size: 10, width: 2, stroke: '#ffffff', fill: '#ffffff' },
      },
      legend: { show: true, live: true },
      hooks: {
        setSelect: [
          (u) => {
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
  {#if entries.length === 0 || !chartData.data}
    <div
      class="flex h-96 items-center justify-center rounded-lg border border-border bg-card"
    >
      <p class="text-sm text-text-secondary">No data available</p>
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
