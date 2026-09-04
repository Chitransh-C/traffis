CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  corridor TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  direction TEXT NOT NULL,
  lanes INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  color TEXT NOT NULL,
  watchlist BOOLEAN NOT NULL DEFAULT FALSE,
  owner_hint TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  plate TEXT NOT NULL,
  canonical_plate TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  camera_id TEXT NOT NULL REFERENCES cameras(id),
  ts TIMESTAMPTZ NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  direction TEXT NOT NULL,
  vehicle_type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS observations_ts_idx ON observations (ts);
CREATE INDEX IF NOT EXISTS observations_vehicle_idx ON observations (vehicle_id);
CREATE INDEX IF NOT EXISTS observations_camera_idx ON observations (camera_id);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  plate TEXT,
  camera_id TEXT
);

CREATE INDEX IF NOT EXISTS alerts_ts_idx ON alerts (ts);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
