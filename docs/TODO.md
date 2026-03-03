# TODO - Unimplemented Features

This document lists **remaining** work from the PRD. Completed features (MVP, comparison, tracker comparison, auth, export, security CI) are summarized below for reference; details are in [PRD](PRD.md) and [ARCHITECTURE](ARCHITECTURE.md).

**Last Updated:** 2026-03-02

---

## Completed (reference)

- **MVP**: File upload (TCX, FIT, GPX, JSON, SML), activity dashboard (filters, pagination), activity visualization (time-series graphs, overlay, tooltips). See PRD 3.1–3.3.
- **Activity Comparison**: Multi-select from dashboard, comparison view `/compare/:id`, time-synchronized overlay charts, statistics comparison table with delta. See PRD 3.4.
- **Tracker Comparison**: Served by Activity Comparison (Section 3.4); multi-device overlay and statistics delta. See PRD 3.6.
- **Auth & multi-user**: OAuth (Google, GitHub), server-side sessions, user-scoped data, account linking by verified email. See [AGENTS.md](../AGENTS.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
- **Account export & deletion**: `GET /api/account/export`, `DELETE /api/account`. See PRD 4.4 and ARCHITECTURE.
- **Security / DevSecOps CI**: Dependency scanning (Dependabot, npm audit, dependency-review-action), secrets (Gitleaks), SAST (Semgrep, eslint-plugin-security), Docker config (Trivy). See ARCHITECTURE and `.github/workflows/security-checks.yml`.

---

## Remaining work

### 3.5 Stream Analysis (PRD 3.5)

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

**Related User Stories:** US-5: Analyze Stream Correlations

---

### Optional / Phase 5

- [ ] **Export graphs as images** (PRD 3.3)
- [ ] **Additional file formats** (PRD Phase 5)
- [ ] **WCAG accessibility compliance** (PRD 5.3)
- [ ] **Docker image scanning** — Deferred until the project builds its own production images; add Trivy image scan to security-scheduled.yml when applicable

*Out of scope per PRD 8.3: mobile app, real-time sync, cloud hosting, advanced ML analytics.*

---

## Implementation Notes (remaining work)

### Dependencies to Consider (Analysis 3.5)

- Statistical calculation library (e.g., simple-statistics, ml-matrix)
- May need backend API endpoints for heavy calculations
- Consider caching correlation results

### API Endpoints Needed

- **Comparison (optional):** Consider batch endpoint for multiple activities: `GET /api/events/batch?ids=...` (or keep using existing endpoints)
- **Analysis:** `POST /api/activities/:activityId/analyze` for correlations, or calculate client-side (may be slow for large datasets)

### Database Considerations

- Current schema supports all required data
- Consider materialized views for correlation calculations (future optimization)

---

## Success Metrics (from PRD Section 6)

### MVP Success Criteria
- [x] Users can upload activity files successfully
- [x] Users can view their activities in a dashboard
- [x] Users can visualize activity data in graphs
- [x] Users can compare two activities side-by-side

### Future Success Metrics
- [ ] User can analyze correlations between streams
- [x] User can compare data from different trackers (via Activity Comparison)
- [ ] System handles 1000+ activities without performance degradation
- [ ] Users report positive experience with visualization quality

---

## Related Documentation

- [PRD.md](PRD.md) - Full Product Requirements Document
- [ARCHITECTURE.md](ARCHITECTURE.md) - System Architecture
- [AGENTS.md](../AGENTS.md) - Development guidelines
