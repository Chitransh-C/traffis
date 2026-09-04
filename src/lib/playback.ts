import networkJson from "../data/network.json";
import {
  ALERTS,
  CAMERAS,
  CAMERA_MAP,
  META,
  OBSERVATIONS,
  ROAD_PATHS,
  VEHICLE_MAP,
  VEHICLES,
  roadPathBetween,
} from "../data/load";
import { opsDayStart } from "./clock";
import { headingDeg, haversineKm, interpolatePath, pathLengthKm } from "./geo";
import type { CameraId, CongestionLevel, CorridorLoad, Hop, LiveVehicle, Observation, TrafficZone, Trajectory } from "../types";

const NEIGHBORS = networkJson.graph as Record<string, string[]>;
const ROAD_LABELS = networkJson.labels as Record<string, string>;

function pairScore(prev: Observation, next: Observation): Hop {
  const from = CAMERA_MAP[prev.cameraId];
  const to = CAMERA_MAP[next.cameraId];
  const a: [number, number] = [from.lat, from.lng];
  const b: [number, number] = [to.lat, to.lng];
  const path = roadPathBetween(prev.cameraId, next.cameraId) ?? [a, b];
  const km = pathLengthKm(path) || haversineKm(a, b);
  const observedMin = (next.timestamp - prev.timestamp) / 60_000;
  const expectedMin = Math.max(3, (km / 28) * 60);
  const plateMatch = prev.canonicalPlate === next.canonicalPlate ? 0.22 : 0.04;
  const ocr = ((prev.confidence + next.confidence) / 2) * 0.18;
  const ratio = observedMin / expectedMin;
  const timeScore = ratio < 0.4 ? 0.2 : ratio > 2.4 ? 0.28 : 0.42;
  const sameCamPenalty = prev.cameraId === next.cameraId ? -0.25 : 0;
  return {
    from: prev.cameraId,
    to: next.cameraId,
    start: prev.timestamp,
    end: next.timestamp,
    km: Number(km.toFixed(2)),
    expectedMin: Number(expectedMin.toFixed(1)),
    observedMin: Number(observedMin.toFixed(1)),
    probability: Number(
      Math.min(0.99, Math.max(0.31, 0.2 + plateMatch + ocr + timeScore + sameCamPenalty)).toFixed(2),
    ),
    path,
  };
}

function trajFor(vehicleId: string): Trajectory {
  const v = VEHICLE_MAP[vehicleId];
  const observations = OBSERVATIONS.filter((o) => o.vehicleId === vehicleId);
  const hops: Hop[] = [];
  for (let i = 1; i < observations.length; i++) {
    const gap = observations[i].timestamp - observations[i - 1].timestamp;
    if (gap > 90 * 60_000) continue;
    hops.push(pairScore(observations[i - 1], observations[i]));
  }
  return { vehicleId, plate: v.plate, hops, observations };
}

export const TRAJECTORIES: Trajectory[] = [];
export const TRAJ_BY_VEHICLE: Record<string, Trajectory> = {};

export function rebuildPlayback() {
  const next = VEHICLES.map((v) => trajFor(v.id));
  TRAJECTORIES.splice(0, TRAJECTORIES.length, ...next);
  for (const key of Object.keys(TRAJ_BY_VEHICLE)) delete TRAJ_BY_VEHICLE[key];
  for (const t of TRAJECTORIES) TRAJ_BY_VEHICLE[t.vehicleId] = t;
}

export function observationsUntil(now: number) {
  const start = opsDayStart(now);
  return OBSERVATIONS.filter((o) => o.timestamp >= start && o.timestamp <= now);
}

export function alertsUntil(now: number) {
  const start = opsDayStart(now);
  return ALERTS.filter((a) => a.timestamp >= start && a.timestamp <= now);
}

export function uniquePlatesUntil(now: number) {
  return new Set(observationsUntil(now).map((o) => o.canonicalPlate)).size;
}

export function liveVehiclesAt(now: number): LiveVehicle[] {
  const live: LiveVehicle[] = [];
  for (const traj of TRAJECTORIES) {
    const hop = traj.hops.find((h) => now >= h.start && now <= h.end);
    if (!hop) continue;
    const v = VEHICLE_MAP[traj.vehicleId];
    const t = (now - hop.start) / Math.max(1, hop.end - hop.start);
    const [lat, lng] = interpolatePath(hop.path, t);
    const ahead = interpolatePath(hop.path, Math.min(1, t + 0.02));
    const last = traj.observations.filter((o) => o.timestamp <= now).at(-1);
    live.push({
      vehicleId: v.id,
      plate: v.plate,
      type: v.type,
      watchlist: v.watchlist,
      lat,
      lng,
      heading: headingDeg([lat, lng], ahead),
      speedKmh: hop.observedMin > 0 ? (hop.km / hop.observedMin) * 60 : 26,
      from: hop.from,
      to: hop.to,
      progress: t,
      lastConfidence: last?.confidence ?? 0.9,
    });
  }
  return live;
}

export function corridorLoadUntil(now: number): CorridorLoad[] {
  const windowStart = now - 50 * 60_000;
  const keys = new Map<string, CorridorLoad>();
  for (const a of CAMERAS) {
    for (const bId of NEIGHBORS[a.id] ?? []) {
      if (a.id >= bId) continue;
      const key = [a.id, bId].sort().join("|");
      keys.set(key, {
        key: `${a.id}-${bId}`,
        from: a.id,
        to: bId,
        path: roadPathBetween(a.id, bId) ?? [
          [a.lat, a.lng],
          [CAMERA_MAP[bId].lat, CAMERA_MAP[bId].lng],
        ],
        count: 0,
        avgSpeed: 0,
        level: "free",
        label: ROAD_LABELS[key] ?? `${a.id.slice(-3)}–${bId.slice(-3)}`,
      });
    }
  }
  for (const traj of TRAJECTORIES) {
    for (const hop of traj.hops) {
      if (hop.end > now || hop.start < windowStart) continue;
      const pair = [hop.from, hop.to].sort().join("|");
      const cur = keys.get(pair);
      if (!cur) continue;
      cur.count += 1;
      const spd = (hop.km / Math.max(hop.observedMin, 0.4)) * 60;
      cur.avgSpeed = (cur.avgSpeed * (cur.count - 1) + spd) / cur.count;
    }
  }
  const cameraHits = Object.fromEntries(CAMERAS.map((c) => [c.id, 0])) as Record<string, number>;
  for (const o of observationsUntil(now)) {
    if (o.timestamp < windowStart) continue;
    cameraHits[o.cameraId] += 1;
  }

  const ARTERY_NEAR: Record<string, CameraId[]> = {
    "race-course": ["CAM_042", "CAM_103"],
    "station-loop": ["CAM_023", "CAM_057"],
    "old-city": ["CAM_011", "CAM_023"],
    "university": ["CAM_057", "CAM_081"],
  };

  const list: CorridorLoad[] = [...keys.values()];
  for (const [id, path] of Object.entries(ROAD_PATHS.arteries)) {
    const near = ARTERY_NEAR[id] ?? [];
    const count = Math.round(near.reduce((s, cam) => s + (cameraHits[cam] ?? 0), 0) / 2);
    list.push({
      key: id,
      from: near[0] ?? "CAM_011",
      to: near[1] ?? near[0] ?? "CAM_011",
      path,
      count,
      avgSpeed: 0,
      level: "free",
      label: ROAD_LABELS[id] ?? id,
    });
  }
  return assignSparseLevels(list);
}

/** At most one heavy corridor and two moderate — a city is never all-red. */
function assignSparseLevels(list: CorridorLoad[]): CorridorLoad[] {
  const ranked = [...list].sort((a, b) => b.count - a.count);
  const heavy = ranked[0] && ranked[0].count >= 5 ? ranked[0].key : null;
  const moderate = new Set(
    ranked
      .filter((c) => c.key !== heavy && c.count >= 3)
      .slice(0, 2)
      .map((c) => c.key),
  );
  return list.map((c) => ({
    ...c,
    level: c.key === heavy ? "heavy" : moderate.has(c.key) ? "moderate" : "free",
  }));
}

export function trafficZonesUntil(now: number): TrafficZone[] {
  const windowStart = now - 40 * 60_000;
  const raw = CAMERAS.map((c) => {
    const count = observationsUntil(now).filter(
      (o) => o.cameraId === c.id && o.timestamp >= windowStart,
    ).length;
    return {
      id: `zone-${c.id}`,
      cameraId: c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      radiusM: 160 + Math.min(count, 8) * 18,
      count,
      level: "free" as CongestionLevel,
    };
  });
  const ranked = [...raw].sort((a, b) => b.count - a.count);
  const heavyId = ranked[0] && ranked[0].count >= 5 ? ranked[0].id : null;
  const modId = ranked.find((z) => z.id !== heavyId && z.count >= 3)?.id;
  return raw.map((z) => ({
    ...z,
    level: z.id === heavyId ? "heavy" : z.id === modId ? "moderate" : "free",
  }));
}

export function cameraActive(now: number, id: CameraId) {
  if (id !== "CAM_081") return true;
  const minsFromSix = (now - META.dayStart) / 60_000;
  return !(minsFromSix >= 8 * 60 && minsFromSix <= 9 * 60 + 30);
}
