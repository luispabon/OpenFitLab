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
  import type { StreamConfig } from '../utils/stream-config'
  import { getStreamConfig } from '../utils/stream-config'

  // Register Chart.js components once at module level
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
    streamData: StreamData
    activityStartDate: number
    config?: StreamConfig
  }

  let { streamData, activityStartDate, config }: Props = $props()

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

  // Reset zoom function (can be called from parent if needed)
  export function resetZoom() {
    if (chartInstance) {
      chartInstance.resetZoom()
      isZoomed = false
    }
  }

  // Get config for this stream type
  const streamConfig = $derived(config ?? getStreamConfig(streamData.type))

  // Prepare chart data: convert absolute timestamps to elapsed time (relative to activity start)
  const chartData = $derived.by(() => {
    if (!streamData.data || streamData.data.length === 0) {
      return { labels: [], values: [], pointCount: 0 }
    }

    // Filter out non-numeric values and convert timestamps
    const points = streamData.data
      .map((point) => {
        const value = point.value
        // Skip non-numeric values
        if (typeof value !== 'number' || isNaN(value)) {
          return null
        }
        // Convert absolute timestamp to elapsed milliseconds from activity start
        const elapsedMs = point.time - activityStartDate
        return {
          x: Math.max(0, elapsedMs),
          y: value,
        }
      })
      .filter((p): p is { x: number; y: number } => p !== null)

    return {
      labels: points.map((p) => p.x),
      values: points.map((p) => p.y),
      pointCount: points.length,
    }
  })

  // Adaptive decimation threshold based on dataset size
  const decimationSamples = $derived.by(() => {
    const count = chartData.pointCount
    if (count <= 1000) return undefined // No decimation for small datasets
    if (count <= 5000) return 1000 // Decimate to 1000 points
    if (count <= 10000) return 1500 // Decimate to 1500 points
    return 2000 // Decimate to 2000 points for very large datasets
  })

  // Format elapsed time for X-axis labels (mm:ss or h:mm:ss)
  function formatElapsedTime(milliseconds: number): string {
    // Ensure non-negative
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
  function formatYAxisValue(value: number): string {
    // Heart Rate should be integers
    if (streamConfig.label === 'Heart Rate') {
      return Math.round(value).toString()
    }
    // Other metrics: show 1 decimal place
    return value.toFixed(1)
  }

  // Initialize chart when canvas is available
  $effect(() => {
    if (!canvasElement || !streamData.data || streamData.data.length === 0) {
      return
    }

    // Destroy existing chart if present
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }

    const data = chartData
    if (data.values.length === 0) {
      return
    }

    // Create Chart.js instance
    chartInstance = new Chart(canvasElement, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: streamConfig.label,
            data: data.values.map((y, i) => ({
              x: data.labels[i],
              y: y,
            })),
            borderColor: streamConfig.color,
            backgroundColor: streamConfig.color + '20', // Add transparency
            borderWidth: 2,
            pointRadius: 0, // Hide points for cleaner look
            pointHoverRadius: 4,
            tension: 0.1, // Slight curve
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
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
                if (value == null || typeof value !== 'number') return `${streamConfig.label}: N/A`
                const unit = streamConfig.unit
                const formattedValue = formatYAxisValue(value)
                return `${streamConfig.label}: ${formattedValue}${unit ? ' ' + unit : ''}`
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
            type: 'linear', // Use linear scale for elapsed time (milliseconds)
            title: {
              display: true,
              text: 'Elapsed Time',
              color: chartColors.text,
            },
            min: 0, // Start at 0:00
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
            title: {
              display: true,
              text: streamConfig.label + (streamConfig.unit ? ` (${streamConfig.unit})` : ''),
              color: chartColors.text,
            },
            beginAtZero: false, // Don't force zero baseline for Y-axis
            ticks: {
              color: chartColors.text,
              callback: function (value) {
                if (typeof value !== 'number') return ''
                return formatYAxisValue(value)
              },
            },
            grid: {
              color: chartColors.grid,
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

    // Check zoom state periodically
    const checkZoomState = () => {
      if (!chartInstance) return
      const xScale = chartInstance.scales.x
      if (!xScale) return
      
      const data = chartData
      if (data.values.length === 0) return
      
      const minX = Math.min(...data.labels)
      const maxX = Math.max(...data.labels)
      const tolerance = (maxX - minX) * 0.01
      
      isZoomed =
        Math.abs(xScale.min - minX) > tolerance || Math.abs(xScale.max - maxX) > tolerance
    }
    
    // Update zoom state after chart renders
    setTimeout(checkZoomState, 100)
    
    // Override update to check zoom state
    const originalUpdate = chartInstance.update.bind(chartInstance)
    chartInstance.update = function(mode?: any) {
      const result = originalUpdate(mode)
      setTimeout(checkZoomState, 50)
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
  {#if !streamData.data || streamData.data.length === 0}
    <div class="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <p class="text-sm text-gray-500 dark:text-gray-400">No data available for {streamConfig.label}</p>
    </div>
  {:else if chartData.pointCount === 0}
    <div class="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
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
