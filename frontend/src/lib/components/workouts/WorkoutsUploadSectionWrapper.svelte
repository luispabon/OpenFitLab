<script lang="ts">
  import WorkoutsUploadSection from './WorkoutsUploadSection.svelte';

  interface Props {
    showBulkBar?: boolean;
    showChildren?: boolean;
    isUploading?: boolean;
    onFilesSelected?: (files: File[]) => void;
  }
  let {
    showBulkBar = false,
    showChildren = false,
    isUploading = false,
    onFilesSelected = () => {},
  }: Props = $props();
</script>

<WorkoutsUploadSection {isUploading} {onFilesSelected}>
  <!-- eslint-disable-next-line svelte/no-useless-children-snippet -- test wrapper: snippet content is conditional -->
  {#snippet children()}
    {#if showBulkBar}
      <div data-testid="bulk-bar">Bulk bar content</div>
    {/if}
    {#if showChildren}
      <div data-testid="upload-children">Children content</div>
    {/if}
  {/snippet}
</WorkoutsUploadSection>
