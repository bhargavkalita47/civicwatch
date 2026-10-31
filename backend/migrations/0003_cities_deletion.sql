-- Add jurisdiction-aware reporting and safe cascading deletion.
-- Run after 0001 and 0002; backfill legacy location rows before enforcing not null.
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  center_lat REAL NOT NULL CHECK(center_lat BETWEEN -90 AND 90),
  center_lng REAL NOT NULL CHECK(center_lng BETWEEN -180 AND 180),
  radius_km REAL NOT NULL CHECK(radius_km > 0)
);
INSERT OR IGNORE INTO cities VALUES
('guwahati','Guwahati','Assam','India',26.1716,91.7606,40),
('shillong','Shillong','Meghalaya','India',25.5788,91.8933,22),
('jorhat','Jorhat','Assam','India',26.7509,94.2037,25),
('silchar','Silchar','Assam','India',24.8333,92.7789,25);
ALTER TABLE issues ADD COLUMN city_id TEXT REFERENCES cities(id);
UPDATE issues SET city_id='guwahati' WHERE latitude BETWEEN 25.9 AND 26.4 AND longitude BETWEEN 91.45 AND 92.05 AND city_id IS NULL;
UPDATE issues SET city_id='shillong' WHERE latitude BETWEEN 25.37 AND 25.79 AND longitude BETWEEN 91.69 AND 92.11 AND city_id IS NULL;
UPDATE issues SET city_id='jorhat' WHERE latitude BETWEEN 26.5 AND 27.01 AND longitude BETWEEN 93.94 AND 94.47 AND city_id IS NULL;
UPDATE issues SET city_id='silchar' WHERE latitude BETWEEN 24.6 AND 25.06 AND longitude BETWEEN 92.54 AND 93.02 AND city_id IS NULL;
CREATE INDEX IF NOT EXISTS issues_city_status_created_idx ON issues(city_id,status,created_at DESC);
CREATE TRIGGER IF NOT EXISTS require_issue_city BEFORE INSERT ON issues
WHEN NEW.city_id IS NULL OR NOT EXISTS(SELECT 1 FROM cities WHERE id=NEW.city_id)
BEGIN SELECT RAISE(ABORT,'A valid city is required'); END;
-- Rebuild old status log table to fix its missing cascade on deletion.
CREATE TABLE status_events_with_cascade (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id),
 previous_status TEXT NOT NULL, next_status TEXT NOT NULL, reason TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO status_events_with_cascade(id,issue_id,actor_id,previous_status,next_status,reason,created_at)
 SELECT id,issue_id,actor_id,previous_status,next_status,reason,created_at FROM status_events;
DROP TABLE status_events;
ALTER TABLE status_events_with_cascade RENAME TO status_events;
CREATE INDEX IF NOT EXISTS status_events_issue_idx ON status_events(issue_id,created_at);
