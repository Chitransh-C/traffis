import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = join(root, "src", "data");
const read = <T>(name: string) => JSON.parse(readFileSync(join(dataDir, name), "utf8")) as T;

type Camera = {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lng: number;
  direction: string;
  lanes: number;
  status: string;
};
type Vehicle = {
  id: string;
  plate: string;
  type: string;
  color: string;
  watchlist: boolean;
  ownerHint: string;
};
type Observation = {
  id: string;
  vehicleId: string;
  plate: string;
  canonicalPlate: string;
  confidence: number;
  cameraId: string;
  timestamp: number;
  lat: number;
  lng: number;
  direction: string;
  vehicleType: string;
};
type Alert = {
  id: string;
  level: string;
  title: string;
  detail: string;
  timestamp: number;
  plate?: string;
  cameraId?: string;
};

async function main() {
  const schema = readFileSync(join(root, "backend", "schema.sql"), "utf8");
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
    await pool.query(stmt);
  }

  const cameras = read<Camera[]>("cameras.json");
  const vehicles = read<Vehicle[]>("vehicles.json");
  const observations = read<Observation[]>("observations.json");
  const alerts = read<Alert[]>("alerts.json");
  const meta = read<Record<string, unknown>>("meta.json");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE alerts, observations, vehicles, cameras, meta RESTART IDENTITY CASCADE");

    for (const c of cameras) {
      await client.query(
        `INSERT INTO cameras (id, name, corridor, lat, lng, direction, lanes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [c.id, c.name, c.corridor, c.lat, c.lng, c.direction, c.lanes, c.status],
      );
    }
    for (const v of vehicles) {
      await client.query(
        `INSERT INTO vehicles (id, plate, type, color, watchlist, owner_hint)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [v.id, v.plate, v.type, v.color, v.watchlist, v.ownerHint],
      );
    }

    const batch = 200;
    for (let i = 0; i < observations.length; i += batch) {
      const slice = observations.slice(i, i + batch);
      const values: unknown[] = [];
      const rows = slice.map((o, idx) => {
        const b = idx * 11;
        values.push(
          o.id,
          o.vehicleId,
          o.plate,
          o.canonicalPlate,
          o.confidence,
          o.cameraId,
          new Date(o.timestamp).toISOString(),
          o.lat,
          o.lng,
          o.direction,
          o.vehicleType,
        );
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11})`;
      });
      await client.query(
        `INSERT INTO observations
          (id, vehicle_id, plate, canonical_plate, confidence, camera_id, ts, lat, lng, direction, vehicle_type)
         VALUES ${rows.join(",")}`,
        values,
      );
    }

    for (const a of alerts) {
      await client.query(
        `INSERT INTO alerts (id, level, title, detail, ts, plate, camera_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [a.id, a.level, a.title, a.detail, new Date(a.timestamp).toISOString(), a.plate ?? null, a.cameraId ?? null],
      );
    }

    await client.query(`INSERT INTO meta (key, value) VALUES ('city', $1::jsonb)`, [JSON.stringify(meta)]);
    await client.query("COMMIT");
    console.log(
      `Seeded ${cameras.length} cameras, ${vehicles.length} vehicles, ${observations.length} observations, ${alerts.length} alerts`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
