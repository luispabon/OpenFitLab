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
    Decimation
  )

  interface Props {
    streamData: StreamData
    activityStartDate: number
    config?: StreamConfig
  }

  let { streamData, activityStartDate, config }: Props = $props()

  let canvasElement: HTMLCanvasElement | null = $state(null)
  let chartInstance: Chart | null = $state(null)

  // Get config for this stream type
  const streamConfig = $derived(config ?? getStreamConfig(streamData.type))

  // Prepare chart data: convert absolute timestamps to elapsed time (relative to activity start)
  const chartData = $derived.by(() => {
    if (!streamData.data || streamData.data.length === 0) {
      return { labels: [], values: [] }
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
          x: elapsedMs,
          y: value,
        }
      })
      .filter((p): p is { x: number; y: number } => p !== null)

    return {
      labels: points.map((p) => p.x),
      values: points.map((p) => p.y),
    }
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
            enabled: true,
            algorithm: 'lttb',
            samples: 500, // Decimate to ~500 points for performance
          },
        },
        scales: {
          x: {
            type: 'linear', // Use linear scale for elapsed time (milliseconds)
            title: {
              display: true,
              text: 'Elapsed Time',
            },
            min: 0, // Start at 0:00
            ticks: {
              callback: function (value) {
                return formatElapsedTime(value as number)
              },
            },
          },
          y: {
            title: {
              display: true,
              text: streamConfig.label + (streamConfig.unit ? ` (${streamConfig.unit})` : ''),
            },
            beginAtZero: false, // Don't force zero baseline for Y-axis
            ticks: {
              callback: function (value) {
                if (typeof value !== 'number') return ''
                return formatYAxisValue(value)
              },
            },
          },
        },
      },
    })

    // Cleanup function
    return () => {
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    }
  })
</script>

<div class="w-full">
  {#if !streamData.data || streamData.data.length === 0}
    <div class="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <p class="text-sm text-gray-500 dark:text-gray-400">No data available for {streamConfig.label}</p>
    </div>
  {:else}
    <div class="h-64 w-full">
      <canvas bind:this={canvasElement}></canvas>
    </div>
  {/if}
</div>
