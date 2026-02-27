<script lang="ts">
  interface Props {
    currentFile: number;
    totalFiles: number;
    progress: number;
    /** When set and > currentFile, display "currentFile-currentBatchEnd of totalFiles" */
    currentBatchEnd?: number;
    fileName?: string;
    label?: string;
    progressColor?: string;
  }

  let {
    currentFile,
    totalFiles,
    progress,
    currentBatchEnd,
    fileName,
    label = 'Uploading file',
    progressColor = 'bg-accent',
  }: Props = $props();

  const fileRangeLabel = $derived(
    currentBatchEnd != null && currentBatchEnd > currentFile
      ? `${currentFile}-${currentBatchEnd}`
      : String(currentFile)
  );
</script>

<div class="mb-4 rounded-md border border-border bg-card p-4 backdrop-blur">
  <div class="mb-2 flex items-center justify-between">
    <p class="text-sm font-medium text-text-primary">
      {label}
      {fileRangeLabel} of {totalFiles}
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
