<script lang="ts">
  import {
    Chart,
    CategoryScale,
    LinearScale,
    TimeScale,
    LineElement,
    PointElement,
    LineController,
    Tooltip,
    Legend,
    Decimation,
  } from 'chart.js'
  import zoomPlugin from 'chartjs-plugin-zoom'
  import 'chartjs-adapter-date-fns'
  import type { StreamData } from '../types'
  import { getStreamConfig } from '../utils/stream-config'

  // Register Chart.js components and zoom plugin
  Chart.register(
    CategoryScale,
    LinearScale,
    TimeScale,
    LineElement,
    PointElement,
    LineController,
    Tooltip,
    Legend,
    Decimation,
    zoomPlugin
  )

  interface Props {
    streams: StreamData[]
    activityStartDate: number
  }

  let { streams, activityStartDate }: Props = $props()

  let canvasElement: HTMLCanvasElement | null = $state(null)
  let chartInstance: Chart | null = $state(null)
  let isZoomed = $state(false)

  // Detect dark mode
  function isDarkMode(): boolean {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  }

  // Get chart colors based on theme
  const chartColors = $derived.by(() => {
    const dark = isDarkMode()
    return {
      text: dark ? '#d1d5db' : '#374151', // gray-300 : gray-700
      grid: dark ? '#374151' : '#e5e7eb', // gray-700 : gray-200
      background: dark ? '#1f2937' : '#ffffff', // gray-800 : white
    }
  })

  // Prepare chart data: convert absolute timestamps to elapsed time
  const chartData = $derived.by(() => {
    return streams.map((stream) => {
      if (!stream.data || stream.data.length === 0) {
        return { type: stream.type, points: [], pointCount: 0 }
      }

      const config = getStreamConfig(stream.type)
      const points = stream.data
        .map((point) => {
          const value = point.value
          if (typeof value !== 'number' || isNaN(value)) {
            return null
          }
          const elapsedMs = point.time - activityStartDate
          return {
            x: Math.max(0, elapsedMs),
            y: value,
          }
        })
        .filter((p): p is { x: number; y: number } => p !== null)

      return {
        type: stream.type,
        config,
        points,
        pointCount: points.length,
      }
    })
  })

  // Adaptive decimation threshold based on largest dataset
  const maxPointCount = $derived.by(() => {
    return Math.max(...chartData.map((d) => d.pointCount), 0)
  })

  const decimationSamples = $derived.by(() => {
    const count = maxPointCount
    if (count <= 1000) return undefined // No decimation for small datasets
    if (count <= 5000) return 1000 // Decimate to 1000 points
    if (count <= 10000) return 1500 // Decimate to 1500 points
    return 2000 // Decimate to 2000 points for very large datasets
  })

  // Format elapsed time for X-axis labels
  function formatElapsedTime(milliseconds: number): string {
    const ms = Math.max(0, milliseconds)
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Format Y-axis value based on stream type
  function formatYAxisValue(value: number, label: string): string {
    if (label === 'Heart Rate') {
      return Math.round(value).toString()
    }
    return value.toFixed(1)
  }

  // Determine which Y-axis to use (left or right)
  // Simple strategy: alternate between left and right, but try to balance
  function getYAxisId(index: number, total: number): 'y' | 'y1' {
    // If only one stream, use left axis
    if (total === 1) return 'y'
    // If two streams, use both axes
    if (total === 2) return index === 0 ? 'y' : 'y1'
    // For more than two, alternate but prefer left for first stream
    return index % 2 === 0 ? 'y' : 'y1'
  }

  // Reset zoom
  function resetZoom() {
    if (chartInstance) {
      chartInstance.resetZoom()
      isZoomed = false
    }
  }

  // Check if chart is zoomed by comparing scale range to data range
  function checkZoomState() {
    if (!chartInstance) return false
    const xScale = chartInstance.scales.x
    if (!xScale) return false
    
    // Get data range
    const allPoints = chartData.flatMap((d) => d.points)
    if (allPoints.length === 0) return false
    
    const minX = Math.min(...allPoints.map((p) => p.x))
    const maxX = Math.max(...allPoints.map((p) => p.x))
    
    // Check if scale range differs from data range (with small tolerance)
    const tolerance = (maxX - minX) * 0.01
    return (
      Math.abs(xScale.min - minX) > tolerance || Math.abs(xScale.max - maxX) > tolerance
    )
  }

  // Initialize chart when canvas is available
  $effect(() => {
    if (!canvasElement || streams.length === 0) {
      return
    }

    // Destroy existing chart if present
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }

    const data = chartData.filter((d) => d.points.length > 0 && d.config)
    if (data.length === 0) {
      return
    }

    // Create datasets for each stream
    const datasets = data
      .filter((streamData) => streamData.config) // Ensure config exists
      .map((streamData, index) => {
        const yAxisId = getYAxisId(index, data.length)
        const config = streamData.config!
        return {
          label: config.label,
          data: streamData.points,
          borderColor: config.color,
          backgroundColor: config.color + '20',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.1,
          fill: false,
          yAxisID: yAxisId,
        }
      })

    // Create Chart.js instance
    chartInstance = new Chart(canvasElement, {
      type: 'line',
      data: {
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index', // Show all values at same X point
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              color: chartColors.text,
              font: {
                size: 12,
              },
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                if (items.length === 0) return ''
                const elapsedMs = items[0].parsed.x
                if (elapsedMs == null || typeof elapsedMs !== 'number') return ''
                return formatElapsedTime(elapsedMs)
              },
              label: (context) => {
                const value = context.parsed.y
                if (value == null || typeof value !== 'number') {
                  return `${context.dataset.label}: N/A`
                }
                const streamData = data.find((d) => d.config?.label === context.dataset.label)
                const config = streamData?.config
                if (!config) {
                  return `${context.dataset.label}: ${value.toFixed(1)}`
                }
                const formattedValue = formatYAxisValue(value, config.label)
                const unit = config.unit ?? ''
                return `${context.dataset.label}: ${formattedValue}${unit ? ' ' + unit : ''}`
              },
            },
          },
          decimation: {
            enabled: decimationSamples !== undefined,
            algorithm: 'lttb',
            samples: decimationSamples ?? 500,
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
                speed: 0.1,
              },
              pinch: {
                enabled: true,
              },
              mode: 'x', // Only zoom X-axis
            },
            pan: {
              enabled: true,
              mode: 'x', // Only pan X-axis
            },
            limits: {
              x: {
                min: 0, // Don't allow panning before start
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Elapsed Time',
              color: chartColors.text,
            },
            min: 0,
            ticks: {
              color: chartColors.text,
              callback: function (value) {
                return formatElapsedTime(value as number)
              },
            },
            grid: {
              color: chartColors.grid,
            },
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: data.length > 0 && !!data[0]?.config,
              text: data[0]?.config
                ? data[0].config.label + (data[0].config.unit ? ` (${data[0].config.unit})` : '')
                : '',
              color: chartColors.text,
            },
            beginAtZero: false,
            ticks: {
              color: chartColors.text,
              callback: function (value) {
                if (typeof value !== 'number') return ''
                return formatYAxisValue(value, data[0]?.config?.label ?? '')
              },
            },
            grid: {
              color: chartColors.grid,
            },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: data.length > 1 && !!data[1]?.config,
              text: data[1]?.config
                ? data[1].config.label + (data[1].config.unit ? ` (${data[1].config.unit})` : '')
                : '',
              color: chartColors.text,
            },
            beginAtZero: false,
            grid: {
              drawOnChartArea: false, // Only draw grid for left axis
            },
            ticks: {
              color: chartColors.text,
              callback: function (value) {
                if (typeof value !== 'number') return ''
                return formatYAxisValue(value, data[1]?.config?.label ?? '')
              },
            },
          },
        },
        onHover: (event, activeElements) => {
          // Change cursor to crosshair when hovering over chart
          if (event.native && canvasElement) {
            canvasElement.style.cursor = activeElements.length > 0 ? 'crosshair' : 'default'
          }
        },
      },
      plugins: [],
    })

    // Update zoom state periodically (after chart updates)
    const updateZoomState = () => {
      isZoomed = checkZoomState()
    }
    
    // Check zoom state after chart updates
    chartInstance.update('none')
    setTimeout(updateZoomState, 100)
    
    // Listen for zoom events via chart update
    const originalUpdate = chartInstance.update.bind(chartInstance)
    chartInstance.update = function(mode?: any) {
      const result = originalUpdate(mode)
      setTimeout(updateZoomState, 50)
      return result
    }

    // Cleanup function
    return () => {
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    }
  })
</script>

<div class="w-full animate-fade-in">
  {#if streams.length === 0 || chartData.every((d) => d.points.length === 0)}
    <div class="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <p class="text-sm text-gray-500 dark:text-gray-400">No data available</p>
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
      <div class="h-64 w-full">
        <canvas bind:this={canvasElement}></canvas>
      </div>
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
</style>
