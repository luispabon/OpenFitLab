export const workoutDragState = $state({
  isDragging: false,
  eventIds: [] as string[],
});

export function startWorkoutDrag(ids: string[]) {
  workoutDragState.isDragging = true;
  workoutDragState.eventIds = ids;
}

export function endWorkoutDrag() {
  workoutDragState.isDragging = false;
  workoutDragState.eventIds = [];
}
