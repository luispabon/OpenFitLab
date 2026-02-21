# Smoke test checklist

Run this checklist after each refactoring stage to confirm the app still works.

1. **Upload a .FIT file via dashboard** → Verify event appears in the list.
2. **Click event** → Verify detail page loads with stats + charts.
3. **Navigate to comparisons** → Verify list loads.
4. **DELETE an event** → Verify removal (event disappears from list).
5. **Filter by activity type on dashboard** → Verify filtering works.
