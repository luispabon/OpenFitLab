-- OpenFitLab database schema
--
-- Tables: users, user_identities, events, event_stats, activities, activity_stats,
--         streams, stream_data_points, comparisons, comparison_event_activities
-- Sessions are stored in Valkey (not in DB). Applied on API startup via db.initializeSchema().
-- No migrations; schema changes require DB recreate.
-- Foreign keys with ON DELETE CASCADE so deleting a user or event removes all related rows.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  display_name VARCHAR(255) NULL,
  avatar_url VARCHAR(2048) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_identities (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  profile_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_provider_identity (provider, provider_user_id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  start_date BIGINT NOT NULL,
  name VARCHAR(512),
  end_date BIGINT NULL,
  description TEXT NULL,
  is_merge TINYINT(1) DEFAULT 0,
  src_file_type VARCHAR(16) NULL,
  start_timezone VARCHAR(64) NULL,
  end_timezone VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_start_date (start_date),
  INDEX idx_user_id (user_id),
  INDEX idx_user_start_date (user_id, start_date),
  CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_stats (
  event_id VARCHAR(36) NOT NULL,
  stat_type VARCHAR(128) NOT NULL,
  value JSON NOT NULL,
  PRIMARY KEY (event_id, stat_type),
  CONSTRAINT fk_event_stats_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  name VARCHAR(512) NULL,
  start_date BIGINT NULL,
  end_date BIGINT NULL,
  type VARCHAR(128) NULL,
  device_name VARCHAR(255) NULL,
  start_timezone VARCHAR(64) NULL,
  end_timezone VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  INDEX idx_type (type),
  INDEX idx_device_name (device_name),
  INDEX idx_start_date (start_date),
  CONSTRAINT fk_activities_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;
-- idx_start_date: supports getActivityRows ORDER BY COALESCE(a.start_date, e.start_date) and date filters

CREATE TABLE IF NOT EXISTS activity_stats (
  activity_id VARCHAR(36) NOT NULL,
  stat_type VARCHAR(128) NOT NULL,
  value JSON NOT NULL,
  PRIMARY KEY (activity_id, stat_type),
  CONSTRAINT fk_activity_stats_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

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
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stream_data_points (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stream_id VARCHAR(128) NOT NULL,
  time_ms BIGINT NOT NULL,
  value JSON NOT NULL,
  sequence_index INT,
  INDEX idx_stream_time (stream_id, time_ms),
  INDEX idx_stream_sequence (stream_id, sequence_index, time_ms),
  CONSTRAINT fk_stream_data_points_stream FOREIGN KEY (stream_id) REFERENCES streams (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;
-- idx_stream_sequence: supports getStreamsForActivity ORDER BY stream_id, sequence_index ASC, time_ms ASC

CREATE TABLE IF NOT EXISTS comparisons (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(512) NOT NULL,
  settings JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id),
  INDEX idx_user_created_at (user_id, created_at),
  CONSTRAINT fk_comparisons_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comparison_event_activities (
  comparison_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  activity_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (comparison_id, event_id),
  INDEX idx_event_id (event_id),
  INDEX idx_activity_id (activity_id),
  CONSTRAINT fk_cea_comparison FOREIGN KEY (comparison_id) REFERENCES comparisons(id) ON DELETE CASCADE,
  CONSTRAINT fk_cea_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_cea_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
)
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;
