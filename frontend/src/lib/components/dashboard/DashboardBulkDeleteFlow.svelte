<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import UploadProgressBar from '../UploadProgressBar.svelte'

  interface Props {
    eventIdsToDelete: string[]
    deleteEvent: (id: string) => Promise<boolean>
    onDone: (successful: number, failed: number) => void
    onClosed: () => void
    isDeleting?: boolean
  }
  let {
    eventIdsToDelete,
    deleteEvent,
    onDone,
    onClosed,
    isDeleting = false,
  }: Props = $props()

  let isBulkDeleting = $state(false)
  let bulkDeleteProgress = $state(0)
  let currentDeleteIndex = $state(0)
  let totalToDelete = $state(0)

  const open = $derived(eventIdsToDelete.length > 0)
  const count = $derived(eventIdsToDelete.length)
  const title = $derived(`Delete ${count} Event${count !== 1 ? 's' : ''}?`)
  const message = $derived(
    `Are you sure you want to delete ${count} event${count !== 1 ? 's' : ''}? This action cannot be undone.`
  )
  const confirmLabel = $derived(`Delete ${count} Event${count !== 1 ? 's' : ''}`)

  async function handleConfirm() {
    const eventIds = eventIdsToDelete
    if (eventIds.length === 0) return

    isBulkDeleting = true
    totalToDelete = eventIds.length
    currentDeleteIndex = 0
    bulkDeleteProgress = 0

    let successful = 0
    let failed = 0

    try {
      for (let i = 0; i < eventIds.length; i++) {
        currentDeleteIndex = i
        bulkDeleteProgress = (i / eventIds.length) * 100

        try {
          const deleted = await deleteEvent(eventIds[i])
          if (deleted) {
            successful++
          } else {
            failed++
          }
        } catch (error) {
          console.error(`Failed to delete event ${eventIds[i]}:`, error)
          failed++
        }
      }

      bulkDeleteProgress = 100
      onDone(successful, failed)
    } finally {
      isBulkDeleting = false
      bulkDeleteProgress = 0
      currentDeleteIndex = 0
      totalToDelete = 0
      onClosed()
    }
  }

  function handleCancel() {
    onClosed()
  }
</script>

{#if open}
  <ConfirmDialog
    {title}
    {message}
    confirmLabel={confirmLabel}
    loading={isBulkDeleting}
    danger={true}
    confirmDisabled={isBulkDeleting || isDeleting}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />
{/if}

{#if open && isBulkDeleting}
  <UploadProgressBar
    currentFile={currentDeleteIndex + 1}
    totalFiles={totalToDelete}
    progress={bulkDeleteProgress}
    label="Deleting event"
    progressColor="bg-danger"
  />
{/if}
