-- OpenFitLab database schema
--
-- Tables: events, event_stats, activities, activity_stats, streams, stream_data_points, comparisons
-- Applied on API startup via db.initializeSchema(). No migrations; schema changes require DB recreate.
-- Foreign keys with ON DELETE CASCADE so deleting an event removes all related rows.

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) PRIMARY KEY,
  start_date BIGINT NOT NULL,
  name VARCHAR(512),
  end_date BIGINT NULL,
  description TEXT NULL,
  is_merge TINYINT(1) DEFAULT 0,
  src_file_type VARCHAR(16) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_start_date (start_date)
);

CREATE TABLE IF NOT EXISTS event_stats (
  event_id VARCHAR(36) NOT NULL,
  stat_type VARCHAR(128) NOT NULL,
  value JSON NOT NULL,
  PRIMARY KEY (event_id, stat_type),
  INDEX idx_event_id (event_id),
  CONSTRAINT fk_event_stats_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  name VARCHAR(512) NULL,
  start_date BIGINT NULL,
  end_date BIGINT NULL,
  type VARCHAR(128) NULL,
  event_start_date BIGINT NULL,
  device_name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  INDEX idx_type (type),
  INDEX idx_device_name (device_name),
  INDEX idx_start_date (start_date),
  CONSTRAINT fk_activities_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
);
-- idx_start_date: supports getActivityRows ORDER BY COALESCE(a.start_date, e.start_date) and date filters

CREATE TABLE IF NOT EXISTS activity_stats (
  activity_id VARCHAR(36) NOT NULL,
  stat_type VARCHAR(128) NOT NULL,
  value JSON NOT NULL,
  PRIMARY KEY (activity_id, stat_type),
  INDEX idx_activity_id (activity_id),
  CONSTRAINT fk_activity_stats_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS streams (
  id VARCHAR(128) PRIMARY KEY,
  activity_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  type VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_id (activity_id),
  INDEX idx_event_id (event_id),
  INDEX idx_type (type),
  UNIQUE KEY unique_activity_stream_type (activity_id, type),
  CONSTRAINT fk_streams_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE,
  CONSTRAINT fk_streams_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stream_data_points (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stream_id VARCHAR(128) NOT NULL,
  time_ms BIGINT NOT NULL,
  value JSON NOT NULL,
  sequence_index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stream_time (stream_id, time_ms),
  INDEX idx_stream_sequence (stream_id, sequence_index, time_ms),
  INDEX idx_stream_id (stream_id),
  INDEX idx_time_range (time_ms),
  CONSTRAINT fk_stream_data_points_stream FOREIGN KEY (stream_id) REFERENCES streams (id) ON DELETE CASCADE
);
-- idx_stream_sequence: supports getStreamsForActivity ORDER BY stream_id, sequence_index ASC, time_ms ASC

CREATE TABLE IF NOT EXISTS comparisons (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  event_ids JSON NOT NULL,
  settings JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
);
