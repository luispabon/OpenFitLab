import { describe, it, expect, beforeEach } from 'vitest';
import { workoutDragState, startWorkoutDrag, endWorkoutDrag } from '../workout-drag.svelte';

beforeEach(() => {
  workoutDragState.isDragging = false;
  workoutDragState.eventIds = [];
});

describe('startWorkoutDrag', () => {
  it('sets isDragging to true and stores event IDs', () => {
    startWorkoutDrag(['id-1', 'id-2']);
    expect(workoutDragState.isDragging).toBe(true);
    expect(workoutDragState.eventIds).toEqual(['id-1', 'id-2']);
  });

  it('overwrites previous drag IDs on a second call', () => {
    startWorkoutDrag(['id-1']);
    startWorkoutDrag(['id-2', 'id-3']);
    expect(workoutDragState.eventIds).toEqual(['id-2', 'id-3']);
  });
});

describe('endWorkoutDrag', () => {
  it('resets isDragging and clears eventIds', () => {
    startWorkoutDrag(['id-1']);
    endWorkoutDrag();
    expect(workoutDragState.isDragging).toBe(false);
    expect(workoutDragState.eventIds).toEqual([]);
  });

  it('is idempotent when called multiple times', () => {
    endWorkoutDrag();
    endWorkoutDrag();
    expect(workoutDragState.isDragging).toBe(false);
    expect(workoutDragState.eventIds).toEqual([]);
  });
});
