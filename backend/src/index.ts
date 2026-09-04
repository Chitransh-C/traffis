import cors from "cors";
import express from "express";
import { pool } from "./db.ts";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", async (_req, res) => {
  const { rows } = await pool.query("SELECT now() AS now");
  res.json({ ok: true, db: rows[0].now });
});

app.get("/api/bootstrap", async (_req, res) => {
  const [cameras, vehicles, observations, alerts, meta] = await Promise.all([
    pool.query("SELECT id, name, corridor, lat, lng, direction, lanes, status FROM cameras ORDER BY id"),
    pool.query(
      "SELECT id, plate, type, color, watchlist, owner_hint AS \"ownerHint\" FROM vehicles ORDER BY id",
    ),
    pool.query(
      `SELECT id, vehicle_id AS "vehicleId", plate, canonical_plate AS "canonicalPlate",
              confidence, camera_id AS "cameraId", (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS timestamp,
              lat, lng, direction, vehicle_type AS "vehicleType"
         FROM observations ORDER BY ts`,
    ),
    pool.query(
      `SELECT id, level, title, detail, (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS timestamp,
              plate, camera_id AS "cameraId"
         FROM alerts ORDER BY ts`,
    ),
    pool.query("SELECT value FROM meta WHERE key = 'city'"),
  ]);

  res.json({
    cameras: cameras.rows,
    vehicles: vehicles.rows,
    observations: observations.rows.map((o) => ({ ...o, timestamp: Number(o.timestamp) })),
    alerts: alerts.rows.map((a) => ({ ...a, timestamp: Number(a.timestamp) })),
    meta: meta.rows[0]?.value ?? {},
    counts: {
      cameras: cameras.rowCount,
      vehicles: vehicles.rowCount,
      observations: observations.rowCount,
      alerts: alerts.rowCount,
    },
  });
});

app.get("/api/observations", async (req, res) => {
  const until = req.query.until ? Number(req.query.until) : undefined;
  const params: unknown[] = [];
  let where = "";
  if (until && Number.isFinite(until)) {
    params.push(new Date(until).toISOString());
    where = "WHERE ts <= $1";
  }
  const { rows } = await pool.query(
    `SELECT id, vehicle_id AS "vehicleId", plate, canonical_plate AS "canonicalPlate",
            confidence, camera_id AS "cameraId", (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS timestamp,
            lat, lng, direction, vehicle_type AS "vehicleType"
       FROM observations ${where} ORDER BY ts`,
    params,
  );
  res.json(rows.map((o) => ({ ...o, timestamp: Number(o.timestamp) })));
});

const port = Number(process.env.PORT ?? 8000);
app.listen(port, () => {
  console.log(`TRAFFIS API on http://localhost:${port}`);
});
