<script lang="ts">
  interface Props {
    currentFile: number;
    totalFiles: number;
    progress: number;
    fileName?: string;
    label?: string;
    progressColor?: string;
  }

  let {
    currentFile,
    totalFiles,
    progress,
    fileName,
    label = 'Uploading file',
    progressColor = 'bg-accent',
  }: Props = $props();
</script>

<div class="mb-4 rounded-md border border-border bg-card p-4 backdrop-blur">
  <div class="mb-2 flex items-center justify-between">
    <p class="text-sm font-medium text-text-primary">
      {label}
      {currentFile} of {totalFiles}
    </p>
    <p class="text-sm text-text-secondary">{Math.round(progress)}%</p>
  </div>
  {#if fileName}
    <p class="mb-2 text-xs text-text-secondary truncate" title={fileName}>
      {fileName}
    </p>
  {/if}
  <div class="h-2 w-full overflow-hidden rounded-full bg-surface">
    <div
      class="h-full {progressColor} transition-all duration-150 ease-out"
      style="width: {progress}%"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="{label} progress"
    ></div>
  </div>
</div>
