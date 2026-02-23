<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { getComparisonsByEventIds } from '../../api/comparisons';

  interface Props {
    eventIdToDelete: string | null;
    deleteEvent: (id: string) => Promise<boolean>;
    onDone: () => void;
    onClosed: () => void;
    onError?: (message: string) => void;
    confirmDisabledWhen?: boolean;
  }
  let {
    eventIdToDelete,
    deleteEvent,
    onDone,
    onClosed,
    onError,
    confirmDisabledWhen = false,
  }: Props = $props();

  let isDeleting = $state(false);
  let affectedComparisons = $state<{ id: string; name: string; createdAt?: number }[]>([]);
  let checkingComparisons = $state(false);

  const open = $derived(eventIdToDelete !== null);

  $effect(() => {
    const id = eventIdToDelete;
    if (!id) {
      affectedComparisons = [];
      return;
    }
    checkingComparisons = true;
    getComparisonsByEventIds([id])
      .then((list) => {
        affectedComparisons = list;
        checkingComparisons = false;
      })
      .catch(() => {
        affectedComparisons = [];
        checkingComparisons = false;
      });
  });

  const warningMessage = $derived(
    affectedComparisons.length > 0
      ? `This will also permanently delete ${affectedComparisons.length} comparison${affectedComparisons.length !== 1 ? 's' : ''}: ${affectedComparisons.map((c) => c.name).join(', ')}.`
      : undefined
  );

  async function handleConfirm() {
    const eventId = eventIdToDelete;
    if (!eventId) return;

    isDeleting = true;
    try {
      const deleted = await deleteEvent(eventId);
      if (deleted) {
        onDone();
      } else {
        onError?.('Event not found');
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to delete event');
    } finally {
      isDeleting = false;
      onClosed();
    }
  }

  function handleCancel() {
    onClosed();
  }
</script>

{#if open}
  <ConfirmDialog
    title="Delete Event?"
    message="Are you sure you want to delete this event? This action cannot be undone."
    confirmLabel="Delete"
    loading={isDeleting}
    danger={true}
    confirmDisabled={isDeleting || confirmDisabledWhen || checkingComparisons}
    {warningMessage}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
  />
{/if}
