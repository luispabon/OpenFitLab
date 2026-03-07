<script lang="ts">
  import type { ActivityRow, EventSummary } from '../../types';
  import { getComparisonCandidates } from '../../api';
  import CompareCandidatesModal from './CompareCandidatesModal.svelte';

  interface Props {
    activityRows: ActivityRow[];
    /** Called with (eventIds, suggestedFolderId for the new comparison). */
    onCompare: (eventIds: string[], suggestedFolderId?: string | null) => void;
    onError?: (message: string) => void;
  }
  let { activityRows, onCompare, onError }: Props = $props();

  let sourceEventId = $state<string | null>(null);
  let candidates = $state<EventSummary[]>([]);
  let candidatesLoading = $state(false);
  let selectedCandidateIds = $state<Set<string>>(new Set());
  let showAllFolders = $state(false);

  const sourceEventRow = $derived.by(() => {
    if (!sourceEventId) return null;
    return activityRows.find((row) => row.event.id === sourceEventId) ?? null;
  });

  const open = $derived(sourceEventId !== null);

  async function loadCandidates(eventId: string) {
    candidatesLoading = true;
    candidates = [];
    selectedCandidateIds = new Set();
    try {
      const found = await getComparisonCandidates(eventId, {
        sameFolderOnly: !showAllFolders,
      });
      candidates = found;
    } catch (error) {
      console.error('Failed to load comparison candidates:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to load comparison candidates');
    } finally {
      candidatesLoading = false;
    }
  }

  export function openForEvent(eventId: string) {
    sourceEventId = eventId;
    showAllFolders = false;
    void loadCandidates(eventId);
  }

  async function toggleShowAllFolders() {
    showAllFolders = !showAllFolders;
    if (sourceEventId) {
      void loadCandidates(sourceEventId);
    }
  }

  function toggleCandidateSelection(eventId: string) {
    const newSet = new Set(selectedCandidateIds);
    if (newSet.has(eventId)) {
      newSet.delete(eventId);
    } else {
      newSet.add(eventId);
    }
    selectedCandidateIds = newSet;
  }

  function handleCompare() {
    if (!sourceEventId || selectedCandidateIds.size === 0) return;
    const eventIds = [sourceEventId, ...Array.from(selectedCandidateIds)];
    const suggestedFolderId = sourceEventRow?.event.folderId ?? null;
    onCompare(eventIds, suggestedFolderId);
    sourceEventId = null;
    candidates = [];
    selectedCandidateIds = new Set();
  }

  function handleCancel() {
    sourceEventId = null;
    candidates = [];
    selectedCandidateIds = new Set();
  }
</script>

<CompareCandidatesModal
  {open}
  {sourceEventRow}
  {candidates}
  {candidatesLoading}
  {selectedCandidateIds}
  {showAllFolders}
  onToggleShowAllFolders={toggleShowAllFolders}
  onToggleCandidate={toggleCandidateSelection}
  onCompare={handleCompare}
  onCancel={handleCancel}
/>
