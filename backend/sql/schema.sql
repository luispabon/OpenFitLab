-- Wave 2: events, activities, original_files for single-user fitness data
-- Run once on fresh DB (e.g. on API startup if tables missing).
-- No foreign keys to avoid charset/collation issues across environments.

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
  INDEX idx_event_id (event_id)
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
  INDEX idx_device_name (device_name)
);

CREATE TABLE IF NOT EXISTS activity_stats (
  activity_id VARCHAR(36) NOT NULL,
  stat_type VARCHAR(128) NOT NULL,
  value JSON NOT NULL,
  PRIMARY KEY (activity_id, stat_type),
  INDEX idx_activity_id (activity_id)
);

CREATE TABLE IF NOT EXISTS original_files (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  extension VARCHAR(16) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  start_date BIGINT,
  original_filename VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id)
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
  UNIQUE KEY unique_activity_stream_type (activity_id, type)
);

CREATE TABLE IF NOT EXISTS stream_data_points (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stream_id VARCHAR(128) NOT NULL,
  time_ms BIGINT NOT NULL,
  value JSON NOT NULL,
  sequence_index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stream_time (stream_id, time_ms),
  INDEX idx_stream_id (stream_id),
  INDEX idx_time_range (time_ms)
);

CREATE TABLE IF NOT EXISTS comparisons (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  event_ids JSON NOT NULL,
  settings JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
);
