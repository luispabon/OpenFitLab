-- Composite indexes on activities to support index-only scans for
-- getDistinctTypes and getDistinctDeviceNames queries (which join via event_id).
CREATE INDEX idx_event_id_type ON activities (event_id, type);
CREATE INDEX idx_event_id_device ON activities (event_id, device_name);
