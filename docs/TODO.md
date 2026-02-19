# TODO - Unimplemented Features

This document lists features from the PRD that are not yet implemented. Features are organized by priority and phase as defined in the PRD.

**Last Updated:** 2026-02-19

---

## Phase 1: MVP (Current) - In Progress

### 3.3 Activity Visualization (In Progress)

**Status:** Mostly Complete  
**Priority:** High (MVP requirement)

**Description:** Display interactive graphs for workout metrics.

**Supported Metrics:**
- Heart Rate (BPM)
- Cadence (steps/min or RPM)
- Pace (min/km or min/mile)
- Elevation (meters/feet)
- Speed (km/h or mph)
- Power (watts)
- Temperature
- Other available stream data

**Requirements:**
- [x] Time-series line graphs for each metric
- [x] X-axis: Time (from activity start)
- [x] Y-axis: Metric value
- [x] Interactive tooltips showing exact values
- [x] Zoom and pan capabilities
- [x] Multiple metrics on same graph (overlay)
- [ ] Export graphs as images (future)

**Acceptance Criteria:**
- [x] Graphs render correctly for all stream types
- [x] Time axis shows correct timestamps
- [x] Tooltips display accurate values
- [x] Graphs are responsive and performant
- [x] Multiple streams can be overlaid

**Technical Tasks:**
- [x] Choose charting library (e.g., Chart.js, D3.js, Plotly, or similar) — uPlot
- [x] Create graph component for time-series data — `TimeSeriesChart.svelte`
- [x] Integrate stream data API endpoint (`GET /api/events/:id/activities/:activityId/streams`)
- [x] Implement time normalization (relative to activity start)
- [x] Add metric selection UI (checkboxes/dropdowns) — pill buttons with color indicators
- [x] Implement overlay functionality for multiple metrics — `OverlayChart.svelte` with dual Y-axes
- [x] Add zoom and pan interactions — X-axis drag-to-zoom with reset button
- [x] Optimize rendering for large datasets (10,000+ data points) — uPlot + spline paths
- [x] Add loading states and error handling — skeleton loaders, error messages, empty states

**Related User Stories:**
- US-3: Visualize Workout Metrics

---

## Phase 2: Visualization & Comparison

### 3.4 Activity Comparison (Planned)

**Status:** Not Started  
**Priority:** High

**Description:** Compare two or more activities side-by-side.

**Requirements:**
- [ ] Select multiple activities for comparison
- [ ] Display activities in synchronized time view
- [ ] Overlay graphs for same metrics (e.g., heart rate from both activities)
- [ ] Highlight differences between activities
- [ ] Show statistics comparison table
- [ ] Support merged view (combine activities into one)

**Acceptance Criteria:**
- [ ] User can select 2+ activities to compare
- [ ] Graphs are synchronized by time or distance
- [ ] Differences are visually highlighted
- [ ] Statistics table shows side-by-side comparison
- [ ] Merged view combines data correctly

**Technical Tasks:**
- [ ] Create comparison selection UI (multi-select from dashboard)
- [ ] Create comparison view route/page (`/compare/:ids`)
- [ ] Implement time synchronization algorithm
- [ ] Create side-by-side graph layout
- [ ] Implement overlay mode for same metrics
- [ ] Calculate and display differences (delta values)
- [ ] Create statistics comparison table component
- [ ] Implement merged activity view (combine streams)
- [ ] Add visual indicators for differences (color coding, annotations)

**Related User Stories:**
- US-4: Compare Activities
- US-5: Merge Activities

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
- [ ] Extract device/tracker information from file metadata (`payload_rest`)
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

**For Visualization (3.3):**
- ~~Charting library: Chart.js, D3.js, Plotly.js, or Recharts~~ — Resolved: uPlot v1.6.32
- ~~Consider performance for large datasets (10,000+ points)~~ — Resolved: uPlot handles this natively
- ~~Ensure responsive design for mobile/tablet~~ — Resolved: ResizeObserver-based responsive charts

**For Comparison (3.4):**
- May reuse visualization components from 3.3
- Need efficient data loading for multiple activities
- Consider memory management for large comparisons

**For Analysis (3.5):**
- Statistical calculation library (e.g., simple-statistics, ml-matrix)
- May need backend API endpoints for heavy calculations
- Consider caching correlation results

**For Tracker Comparison (3.6):**
- Device metadata extraction from `payload_rest`
- May need fuzzy matching for similar activities
- Consider time window matching for same activity from different devices

### API Endpoints Needed

**For Visualization:**
- ✅ `GET /api/events/:id/activities/:activityId/streams` (already exists)

**For Comparison:**
- [ ] Consider batch endpoint for multiple activities: `GET /api/events/batch?ids=...`
- [ ] Or use existing endpoints multiple times

**For Analysis:**
- [ ] `POST /api/activities/:activityId/analyze` - Calculate correlations
- [ ] Or calculate client-side (may be slow for large datasets)

**For Tracker Comparison:**
- [ ] `GET /api/activities/:activityId/devices` - Get device metadata
- [ ] `GET /api/activities/similar/:activityId` - Find similar activities from different devices

### Database Considerations

- Current schema supports all required data
- ~~May need indexes on `stream_data_points.time_ms` for performance~~ — Done: `idx_stream_time`, `idx_stream_id`, `idx_time_range` indexes exist
- Consider materialized views for correlation calculations (future optimization)

---

## Success Metrics (from PRD Section 6)

### MVP Success Criteria
- [x] Users can upload activity files successfully
- [x] Users can view their activities in a dashboard
- [x] Users can visualize activity data in graphs
- [ ] Users can compare two activities side-by-side

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
