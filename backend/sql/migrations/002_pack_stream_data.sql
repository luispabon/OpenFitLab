-- Pack stream samples into streams.data JSON (compressed). Backfill from stream_data_points,
-- drop redundant Time streams and streams.created_at. stream_data_points is dropped in a later migration.

ALTER TABLE streams
  ADD COLUMN data JSON COMPRESSED NOT NULL DEFAULT ('[]') AFTER type;

UPDATE streams s
SET s.data = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT('time', sdp.time_ms, 'value', sdp.value)
    ORDER BY sdp.sequence_index, sdp.time_ms
  )
  FROM stream_data_points sdp
  WHERE sdp.stream_id = s.id
);

UPDATE streams SET data = '[]' WHERE data IS NULL;

DELETE FROM streams WHERE type = 'Time';

ALTER TABLE streams DROP COLUMN created_at;
