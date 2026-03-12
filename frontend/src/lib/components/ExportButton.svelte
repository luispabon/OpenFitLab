<script lang="ts">
  interface Props {
    onExport: () => Promise<void>;
    title?: string;
  }
  let { onExport, title = 'Export as PNG' }: Props = $props();

  let exporting = $state(false);

  async function handleClick() {
    if (exporting) return;
    exporting = true;
    try {
      await onExport();
    } catch (err) {
      console.error('[ExportButton] export failed:', err);
    } finally {
      exporting = false;
    }
  }
</script>

<button
  type="button"
  onclick={handleClick}
  disabled={exporting}
  {title}
  data-export-exclude
  class="flex items-center justify-center rounded border border-border bg-transparent p-1.5 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
>
  <span class="material-icons text-base" aria-hidden="true"
    >{exporting ? 'hourglass_empty' : 'download'}</span
  >
</button>
