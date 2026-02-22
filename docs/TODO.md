# TODO - Unimplemented Features

This document lists features from the PRD that are not yet implemented. Features are organized by priority and phase as defined in the PRD.

**Last Updated:** 2026-02-22

---

## Phase 1: MVP (Current)

### 3.3 Activity Visualization

**Status:** Complete (one optional enhancement open)  
**Priority:** High (MVP requirement)

**Remaining (future):**
- [ ] Export graphs as images

**Related User Stories:** US-3: Visualize Workout Metrics

---

## Phase 2: Visualization & Comparison

### 3.4 Activity Comparison

**Status:** Complete (optional enhancements deferred)  
**Priority:** High

**Description:** Compare two or more activities side-by-side. Implemented: multi-select from dashboard, comparison view `/compare/:id`, time-synchronized overlay charts, statistics comparison table with delta column.

**Remaining (candidates for removal / low priority):**
- [ ] Highlight differences on charts (delta is already shown in stats table)
- [ ] Merged view (combine activities into one)
- [ ] Visual indicators for differences (color coding, annotations on charts)

**Related User Stories:** US-4: Compare Activities, US-5: Merge Activities

---

## Phase 3: Analysis

### 3.5 Stream Analysis (Planned)

**Status:** Not Started  
**Priority:** Medium

**Description:** Analyze relationships between different data streams.

**Features:**
- **Correlation Analysis**: Calculate correlation coefficients between streams
- **XY Plots**: Scatter plots showing relationship between two metrics
- **Correlation Index**: Numerical measure of correlation strength
- **Statistical Analysis**: Mean, median, standard deviation, etc.

**Use Cases:**
- Heart rate vs. Pace correlation
- Cadence vs. Speed relationship
- Elevation vs. Heart rate analysis
- Power vs. Speed correlation (cycling)

**Requirements:**
- [ ] Generate correlation matrices
- [ ] Create XY scatter plots
- [ ] Display correlation coefficients (Pearson, Spearman)
- [ ] Highlight strong correlations
- [ ] Export analysis data

**Acceptance Criteria:**
- [ ] Correlation coefficients calculated correctly
- [ ] XY plots display relationships clearly
- [ ] Correlation indices are accurate
- [ ] Analysis works for any two stream types
- [ ] Results are exportable

**Technical Tasks:**
- [ ] Implement correlation calculation functions (Pearson, Spearman)
- [ ] Create correlation matrix visualization component
- [ ] Create XY scatter plot component
- [ ] Add stream pair selection UI
- [ ] Implement statistical calculations (mean, median, std dev, etc.)
- [ ] Create analysis view/page (`/activity/:id/analysis`)
- [ ] Add correlation strength indicators (color coding, thresholds)
- [ ] Implement data export functionality (CSV, JSON)

**Related User Stories:**
- US-6: Analyze Stream Correlations

---

## Phase 4: Tracker Comparison

### 3.6 Tracker Comparison (Planned)

**Status:** Not Started  
**Priority:** Medium

**Description:** Compare data from different fitness trackers for the same activity.

**Requirements:**
- [ ] Identify activities from different devices
- [ ] Overlay data from multiple trackers
- [ ] Calculate differences between measurements
- [ ] Highlight discrepancies
- [ ] Generate accuracy assessment
- [ ] Show which tracker provides more consistent data

**Use Cases:**
- Compare heart rate from Garmin vs. Apple Watch
- Compare GPS accuracy between devices
- Evaluate cadence sensor differences
- Assess elevation measurement accuracy

**Acceptance Criteria:**
- [ ] Can identify activities from different devices
- [ ] Data from multiple trackers can be overlaid
- [ ] Differences are calculated and displayed
- [ ] Accuracy metrics are meaningful
- [ ] Results help users evaluate tracker quality

**Technical Tasks:**
- [ ] Extract device/tracker information from file metadata (device name already stored on activities)
- [ ] Create device identification logic
- [ ] Create tracker comparison view/page (`/tracker-compare/:activityId`)
- [ ] Implement time alignment for different trackers
- [ ] Calculate measurement differences (delta, percentage)
- [ ] Create accuracy metrics (consistency, variance, etc.)
- [ ] Visualize discrepancies (highlight areas of difference)
- [ ] Generate comparison report

**Related User Stories:**
- US-7: Compare Fitness Trackers

---

## Phase 5: Enhancements (Future)

### Additional Features (Out of Scope for MVP)

**Status:** Future  
**Priority:** Low

- [ ] Additional file formats support
- [ ] Authentication and multi-user support
- [ ] Mobile app
- [ ] Real-time sync from fitness trackers
- [ ] Advanced analytics and insights
- [ ] Export data capability (mentioned in PRD section 4.4)
- [ ] Graph export as images (mentioned in 3.3)
- [ ] WCAG accessibility compliance (mentioned in 5.3)

---

## Implementation Notes

### Dependencies to Consider

**For Comparison (3.4):**
- May reuse visualization components from 3.3
- Need efficient data loading for multiple activities
- Consider memory management for large comparisons

**For Analysis (3.5):**
- Statistical calculation library (e.g., simple-statistics, ml-matrix)
- May need backend API endpoints for heavy calculations
- Consider caching correlation results

**For Tracker Comparison (3.6):**
- Device metadata extraction from file metadata (device_name column used when available)
- May need fuzzy matching for similar activities
- Consider time window matching for same activity from different devices

### API Endpoints Needed

**For Comparison (optional):**
- [ ] Consider batch endpoint for multiple activities: `GET /api/events/batch?ids=...` (or keep using existing endpoints)

**For Analysis:**
- [ ] `POST /api/activities/:activityId/analyze` - Calculate correlations
- [ ] Or calculate client-side (may be slow for large datasets)

**For Tracker Comparison:**
- [ ] `GET /api/activities/:activityId/devices` - Get device metadata
- [ ] `GET /api/activities/similar/:activityId` - Find similar activities from different devices

### Database Considerations

- Current schema supports all required data
- Consider materialized views for correlation calculations (future optimization)

### Comparisons CASCADE (schema cleanup)

- [ ] **Comparisons–event relationship and ON DELETE CASCADE:** When an event is deleted, comparisons that reference it currently keep stale IDs in `event_ids` JSON. Normalize and add CASCADE so comparison–event links are removed automatically.
  - Add table e.g. `comparison_events` (`comparison_id`, `event_id`) with FKs to `comparisons(id)` and `events(id)`; use `ON DELETE CASCADE` from `events` so rows are removed when an event is deleted.
  - Migrate existing `comparisons.event_ids` JSON into `comparison_events` rows (one-time or on startup).
  - Update comparison API/service to read/write via `comparison_events` (and optionally keep or drop `event_ids` on `comparisons`).
  - Decide behaviour when a comparison’s events are partially deleted (e.g. filter out missing event IDs in API responses, or treat comparison as invalid).

---

## Success Metrics (from PRD Section 6)

### MVP Success Criteria
- [x] Users can upload activity files successfully
- [x] Users can view their activities in a dashboard
- [x] Users can visualize activity data in graphs
- [x] Users can compare two activities side-by-side

### Future Success Metrics
- [ ] User can analyze correlations between streams
- [ ] User can compare data from different trackers
- [ ] System handles 1000+ activities without performance degradation
- [ ] Users report positive experience with visualization quality

---

## Related Documentation

- [PRD.md](./PRD.md) - Full Product Requirements Document
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System Architecture
- [AGENTS.md](../AGENTS.md) - Development guidelines
