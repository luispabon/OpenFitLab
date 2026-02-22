<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'

  interface Props {
    eventIdToDelete: string | null
    deleteEvent: (id: string) => Promise<boolean>
    onDone: () => void
    onClosed: () => void
    onError?: (message: string) => void
    confirmDisabledWhen?: boolean
  }
  let {
    eventIdToDelete,
    deleteEvent,
    onDone,
    onClosed,
    onError,
    confirmDisabledWhen = false,
  }: Props = $props()

  let isDeleting = $state(false)

  const open = $derived(eventIdToDelete !== null)

  async function handleConfirm() {
    const eventId = eventIdToDelete
    if (!eventId) return

    isDeleting = true
    try {
      const deleted = await deleteEvent(eventId)
      if (deleted) {
        onDone()
      } else {
        onError?.('Event not found')
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      onError?.(error instanceof Error ? error.message : 'Failed to delete event')
    } finally {
      isDeleting = false
      onClosed()
    }
  }

  function handleCancel() {
    onClosed()
  }
</script>

{#if open}
  <ConfirmDialog
    title="Delete Event?"
    message="Are you sure you want to delete this event? This action cannot be undone."
    confirmLabel="Delete"
    loading={isDeleting}
    danger={true}
    confirmDisabled={isDeleting || confirmDisabledWhen}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />
{/if}
