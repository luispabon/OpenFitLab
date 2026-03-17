<script lang="ts">
  import type { ActivityRow } from '../../lib/types';

  interface Props {
    activityRows?: ActivityRow[];
    onCompare?: (eventIds: string[], suggestedFolderId?: string | null) => void;
  }
  let { activityRows: _activityRows = [], onCompare: _onCompare }: Props = $props();

  export function openForEvent(_eventId: string) {
    // stub - no-op
  }
</script>
