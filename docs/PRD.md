# Product Requirements Document (PRD)
## OpenFitLab - Fitness Activity Tracker

### Version: 1.0
### Date: 2026-02-16

---

## 1. Product Overview

### 1.1 Vision
OpenFitLab is a self-hosted fitness activity tracking and comparison platform that empowers users to analyze their workout data, compare activities, and evaluate the accuracy of different fitness trackers.

### 1.2 Mission
Provide a privacy-focused, self-hosted solution for fitness enthusiasts to upload, visualize, and analyze their activity data from various fitness devices and file formats.

### 1.3 Target Users
- **Primary**: Fitness enthusiasts who track activities with multiple devices
- **Secondary**: Athletes and coaches analyzing performance data
- **Tertiary**: Data-conscious users who want to self-host their fitness data

### 1.4 Key Value Propositions
- **Privacy**: Self-hosted solution - user owns their data
- **Comparison**: Compare workouts side-by-side and analyze differences
- **Tracker Evaluation**: Compare data from different fitness trackers to assess accuracy
- **Flexibility**: Support multiple file formats (TCX, FIT, GPX, JSON, SML)
- **Visualization**: Interactive graphs for heart rate, cadence, pace, elevation, and more

---

## 2. User Stories

### 2.1 Core User Stories

**US-1: Upload Activity Files**
- **As a** fitness enthusiast
- **I want to** upload activity files from my fitness tracker
- **So that** I can store and analyze my workout data

**US-2: View Activity Data**
- **As a** user
- **I want to** view my activities in a dashboard
- **So that** I can see all my workouts at a glance

**US-3: Visualize Workout Metrics**
- **As a** user
- **I want to** see graphs of heart rate, cadence, pace, and elevation
- **So that** I can understand my performance during workouts

**US-4: Compare Activities**
- **As a** user
- **I want to** compare two or more workouts side-by-side
- **So that** I can see how my performance changes over time

**US-5: Merge Activities**
- **As a** user
- **I want to** merge multiple activities into one view
- **So that** I can analyze combined workout data

**US-6: Analyze Stream Correlations**
- **As a** user
- **I want to** see correlation analysis between different data streams (e.g., heart rate vs. pace)
- **So that** I can understand relationships in my performance data

**US-7: Compare Fitness Trackers**
- **As a** user
- **I want to** compare data from different fitness trackers
- **So that** I can evaluate which device provides more accurate measurements

---

## 3. Features

### 3.1 File Upload (MVP - Complete)

**Description**: Users can upload activity files in multiple formats.

**Supported Formats**:
- TCX (Training Center XML)
- FIT (Garmin FIT)
- GPX (GPS Exchange Format)
- JSON (Suunto JSON)
- SML (Suunto Markup Language)

**Requirements**:
- Accept single or multiple file uploads
- Parse files server-side using `@sports-alliance/sports-lib`
- Extract event metadata, activities, statistics, and stream data
- Store parsed data in relational database
- Discard original files after parsing
- Display upload success/failure feedback

**Acceptance Criteria**:
- [x] User can select and upload files via web interface
- [x] Backend parses files and extracts all data
- [x] Data is stored in database with proper relationships
- [x] User receives confirmation of successful upload
- [x] Error messages are clear and actionable

### 3.2 Activity Dashboard (MVP - Complete)

**Description**: Display list of all uploaded activities/events.

**Requirements**:
- Show events in reverse chronological order
- Display event name, start date, and basic metadata
- Support filtering by date range
- Link to detailed event view
- Pagination or limit results (default: 50, max: 200)

**Acceptance Criteria**:
- [x] Events displayed in table format
- [x] Sortable by date
- [x] Filterable by start/end date
- [x] Clickable to view details
- [x] Responsive design

### 3.3 Activity Visualization (In Progress)

**Description**: Display interactive graphs for workout metrics.

**Supported Metrics**:
- Heart Rate (BPM)
- Cadence (steps/min or RPM)
- Pace (min/km or min/mile)
- Elevation (meters/feet)
- Speed (km/h or mph)
- Power (watts)
- Temperature
- Other available stream data

**Requirements**:
- Time-series line graphs for each metric
- X-axis: Time (from activity start)
- Y-axis: Metric value
- Interactive tooltips showing exact values
- Zoom and pan capabilities
- Multiple metrics on same graph (overlay)
- Export graphs as images (future)

**Acceptance Criteria**:
- [ ] Graphs render correctly for all stream types
- [ ] Time axis shows correct timestamps
- [ ] Tooltips display accurate values
- [ ] Graphs are responsive and performant
- [ ] Multiple streams can be overlaid

### 3.4 Activity Comparison (Planned)

**Description**: Compare two or more activities side-by-side.

**Requirements**:
- Select multiple activities for comparison (implemented)
- Display activities in synchronized time view (implemented)
- Overlay graphs for same metrics (e.g., heart rate from both activities) (implemented)
- Highlight differences between activities (candidate for removal - chart-level highlighting not implemented; delta column in stats table IS included)
- Show statistics comparison table (implemented)
- Support merged view (combine activities into one) (candidate for removal)

**Acceptance Criteria**:
- [x] User can select 2+ activities to compare
- [x] Graphs are synchronized by time or distance (time sync implemented; distance sync candidate for removal)
- [ ] Differences are visually highlighted (candidate for removal - chart-level highlighting not implemented; delta column in stats table IS included)
- [x] Statistics table shows side-by-side comparison
- [ ] Merged view combines data correctly (candidate for removal)

### 3.5 Stream Analysis (Planned)

**Description**: Analyze relationships between different data streams.

**Features**:
- **Correlation Analysis**: Calculate correlation coefficients between streams
- **XY Plots**: Scatter plots showing relationship between two metrics
- **Correlation Index**: Numerical measure of correlation strength
- **Statistical Analysis**: Mean, median, standard deviation, etc.

**Use Cases**:
- Heart rate vs. Pace correlation
- Cadence vs. Speed relationship
- Elevation vs. Heart rate analysis
- Power vs. Speed correlation (cycling)

**Requirements**:
- Generate correlation matrices
- Create XY scatter plots
- Display correlation coefficients (Pearson, Spearman)
- Highlight strong correlations
- Export analysis data

**Acceptance Criteria**:
- [ ] Correlation coefficients calculated correctly
- [ ] XY plots display relationships clearly
- [ ] Correlation indices are accurate
- [ ] Analysis works for any two stream types
- [ ] Results are exportable

### 3.6 Tracker Comparison (Planned)

**Description**: Compare data from different fitness trackers for the same activity.

**Requirements**:
- Identify activities from different devices
- Overlay data from multiple trackers
- Calculate differences between measurements
- Highlight discrepancies
- Generate accuracy assessment
- Show which tracker provides more consistent data

**Use Cases**:
- Compare heart rate from Garmin vs. Apple Watch
- Compare GPS accuracy between devices
- Evaluate cadence sensor differences
- Assess elevation measurement accuracy

**Acceptance Criteria**:
- [ ] Can identify activities from different devices
- [ ] Data from multiple trackers can be overlaid
- [ ] Differences are calculated and displayed
- [ ] Accuracy metrics are meaningful
- [ ] Results help users evaluate tracker quality

---

## 4. Technical Requirements

### 4.1 Deployment Model
- **Self-hosted**: Docker Compose deployment
- **Multi-user**: Authentication required. OAuth (Google, GitHub) with server-side session cookies. Each user's data is isolated; no admin roles. If a user signs in with both Google and GitHub using the same verified email, they receive one account (automatic account linking).
- **Data ownership**: User owns all data; export and account deletion available.

### 4.2 Technology Stack

**Backend**:
- Node.js 24+
- Express.js
- MariaDB 12.2+
- `@sports-alliance/sports-lib` for file parsing

**Frontend**:
- Svelte 5
- Vite 7
- TypeScript 5.9
- Tailwind CSS v4
- svelte-spa-router

**Infrastructure**:
- Docker Compose
- MariaDB database
- No external dependencies (self-contained)

### 4.3 Performance Requirements
- File upload: Support files up to 50MB
- Database queries: < 500ms for event list
- Graph rendering: < 2s for 10,000 data points
- Concurrent users: Support multiple concurrent users; data scoped per authenticated user

### 4.4 Data Requirements
- Store all activity data relationally
- Support unlimited activities per user
- Retain data indefinitely (user-controlled)
- Export data capability (future)

### 4.5 Security Requirements
- Authentication required: OAuth (Google, GitHub) with server-side sessions; all data endpoints protected and user-scoped
- SQL injection prevention (parameterized queries)
- File upload validation (format checking)
- CORS configuration for production; rate limiting on auth and uploads

---

## 5. User Experience

### 5.1 User Flow

```
1. User starts application (docker compose up)
2. User signs in via Google or GitHub (OAuth) on the login page
3. User navigates to dashboard
4. User uploads activity file
5. System parses file and stores data
6. User views activity in dashboard
7. User clicks activity to view details
8. User sees graphs and statistics
9. User selects activities to compare
10. User views comparison graphs
11. User analyzes correlations
```

### 5.2 Key Screens

1. **Login**: Sign in with Google or GitHub (OAuth); no username/password
2. **Dashboard**: List of all activities
3. **Upload**: File upload interface
4. **Activity Detail**: Single activity view with graphs
5. **Comparison View**: Side-by-side activity comparison
5. **Analysis View**: Correlation and statistical analysis

### 5.3 Design Principles
- **Simplicity**: Clean, uncluttered interface
- **Data-focused**: Graphs and data are primary
- **Responsive**: Works on desktop and tablet
- **Accessible**: Follow WCAG guidelines (future)

---

## 6. Success Metrics

### 6.1 MVP Success Criteria
- [x] Users can upload activity files successfully
- [x] Users can view their activities in a dashboard
- [ ] Users can visualize activity data in graphs
- [ ] Users can compare two activities side-by-side

### 6.2 Future Success Metrics
- User can analyze correlations between streams
- User can compare data from different trackers
- System handles 1000+ activities without performance degradation
- Users report positive experience with visualization quality

---

## 7. Roadmap

### Phase 1: MVP (Current)
- [x] File upload (TCX, FIT, GPX, JSON, SML)
- [x] Activity dashboard
- [x] Database schema and API
- [ ] Basic activity visualization

### Phase 2: Visualization & Comparison
- [ ] Complete activity visualization (all stream types)
- [ ] Activity comparison (side-by-side)
- [ ] Merged activity view
- [ ] Enhanced graph interactions

### Phase 3: Analysis
- [ ] Stream correlation analysis
- [ ] XY plots and correlation indices
- [ ] Statistical analysis tools
- [ ] Export analysis results

### Phase 4: Tracker Comparison
- [ ] Device identification
- [ ] Multi-tracker overlay
- [ ] Accuracy assessment
- [ ] Tracker quality metrics

### Phase 5: Enhancements
- [x] Authentication and multi-user support (OAuth + session; user-scoped data; account export and deletion; account linking by verified email)
- [ ] Additional file formats
- [ ] Mobile app
- [ ] Real-time sync from fitness trackers
- [ ] Advanced analytics and insights

---

## 8. Constraints and Assumptions

### 8.1 Constraints
- Self-hosted deployment only
- Multi-user with authentication required (OAuth; no username/password)
- Limited to supported file formats
- No cloud dependencies

### 8.2 Assumptions
- Users have basic technical knowledge (Docker)
- Users have access to activity files from their devices
- Users want to compare and analyze their own data
- Privacy and data ownership are priorities

### 8.3 Out of Scope (MVP)
- Mobile app
- Real-time data sync
- Social features
- Cloud hosting (optional; see docs/HOSTING.md)
- Advanced machine learning analytics

---

## 9. Risks and Mitigations

### 9.1 Technical Risks
- **Risk**: Large files cause performance issues
  - **Mitigation**: Implement file size limits, optimize parsing

- **Risk**: Database grows too large
  - **Mitigation**: Implement data retention policies, archiving

- **Risk**: Parsing errors for edge cases
  - **Mitigation**: Comprehensive error handling, fallback parsing

### 9.2 User Experience Risks
- **Risk**: Complex interface confuses users
  - **Mitigation**: Iterative design, user testing, clear documentation

- **Risk**: Performance issues with large datasets
  - **Mitigation**: Pagination, lazy loading, data aggregation

---

## 10. Appendices

### 10.1 Glossary

These terms define the product; technical implementation (tables, API) is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- **Event**: A top-level workout session created from a single file upload. An event can contain one or more activities and has event-level statistics aggregated across all its activities. The event name is typically derived from the uploaded filename.

- **Activity**: An individual sport segment within an event. Each activity has a sport type (Running, Cycling, Swimming, etc.), its own statistics, and owns all time-series stream data (heart rate, GPS, cadence, etc.). Most single-sport files create one event with one activity, while multi-sport files (e.g., triathlons) create one event with multiple activities.

- **Stream**: Time-series data belonging to an activity (e.g., Heart Rate, GPS Position, Cadence, Pace). Each stream contains multiple timestamped data points.

- **Data Point**: A single timestamped value in a stream, stored with a `time_ms` timestamp and a value (can be a number or object).

- **Stat**: An aggregated metric calculated from stream data or provided by the source file. Examples include average heart rate, total distance, duration, max pace, etc. Stats are stored separately for events (`event_stats`) and activities (`activity_stats`).

### 10.2 References
- [sports-lib Documentation](https://github.com/SportsAlliance/sports-lib)
- [Svelte Documentation](https://svelte.dev/docs)
- [Vite Documentation](https://vite.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MariaDB Documentation](https://mariadb.com/docs/)

### 10.3 Change Log
- **2026-02-16**: Initial PRD created
- MVP file upload and dashboard complete
- Visualization and comparison features in progress
