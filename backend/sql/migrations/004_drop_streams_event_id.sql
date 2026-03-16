-- Drop denormalized event_id from streams; ownership scoping via activities.event_id.
ALTER TABLE streams
  DROP FOREIGN KEY fk_streams_event,
  DROP INDEX idx_event_id,
  DROP COLUMN event_id;
