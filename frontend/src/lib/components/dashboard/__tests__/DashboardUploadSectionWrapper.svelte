<script lang="ts">
  import DashboardUploadSection from '../DashboardUploadSection.svelte';

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

<DashboardUploadSection {isUploading} {onFilesSelected}>
  {#snippet bulkBar()}
    {#if showBulkBar}
      <div data-testid="bulk-bar">Bulk bar content</div>
    {/if}
  {/snippet}
  {#snippet children()}
    {#if showChildren}
      <div data-testid="upload-children">Children content</div>
    {/if}
  {/snippet}
</DashboardUploadSection>
