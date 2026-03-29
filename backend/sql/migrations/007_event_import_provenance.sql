-- Import provenance for third-party sources (e.g. Strava). File uploads keep both columns NULL.
-- UNIQUE allows multiple rows per user with NULL import keys; duplicate (user, provider, external id) fails.

ALTER TABLE events
  ADD COLUMN import_provider VARCHAR(32) NULL AFTER src_file_type,
  ADD COLUMN import_external_id VARCHAR(64) NULL AFTER import_provider;

CREATE UNIQUE INDEX uk_events_user_import ON events (user_id, import_provider, import_external_id);
