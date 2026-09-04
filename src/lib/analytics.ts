import { ALERTS, CAMERAS } from "../data/load";
import { opsDayStart } from "./clock";
import { TRAJECTORIES } from "./playback";
import type { CameraId, Observation, VehicleType } from "../types";

export function hourlyVolume(obs: Observation[], now?: number) {
  const origin = opsDayStart(now ?? obs[0]?.timestamp ?? 0);
  const buckets = Array.from({ length: 17 }, (_, i) => ({
    hour: `${String(6 + i).padStart(2, "0")}:00`,
    count: 0,
  }));
  for (const o of obs) {
    const idx = Math.floor((o.timestamp - origin) / 3_600_000);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
  }
  return buckets;
}

export function typeMix(obs: Observation[]) {
  const counts: Record<VehicleType, number> = { car: 0, bike: 0, bus: 0, truck: 0, auto: 0 };
  const seen = new Set<string>();
  for (const o of obs) {
    if (seen.has(o.vehicleId)) continue;
    seen.add(o.vehicleId);
    counts[o.vehicleType] += 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);
}

export function elapsedHours(now: number) {
  return Math.max(0, Math.min(16, Math.floor((now - opsDayStart(now)) / 3_600_000)));
}

export function alertBreakdown(until: number) {
  const buckets = { critical: 0, warn: 0, info: 0 };
  for (const a of ALERTS) {
    if (a.timestamp > until) continue;
    buckets[a.level] += 1;
  }
  return [
    { name: "Watchlist / critical", value: buckets.critical, fill: "#ff6b8a" },
    { name: "Warnings", value: buckets.warn, fill: "#f5c15a" },
    { name: "OCR / info", value: buckets.info, fill: "#8ea0b8" },
  ].filter((d) => d.value > 0);
}

export function topOdPairs(until: number, limit = 5) {
  const { ids, grid } = odMatrix(until);
  return ids
    .flatMap((o) => ids.map((d) => ({ from: o, to: d, n: grid[`${o}|${d}`] })))
    .filter((r) => r.n > 0 && r.from !== r.to)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((r) => ({
      route: `${CAMERA_SHORT[r.from] ?? r.from} → ${CAMERA_SHORT[r.to] ?? r.to}`,
      trips: r.n,
    }));
}

export function cameraThroughput(obs: Observation[]) {
  return CAMERAS.map((c) => ({
    id: c.id,
    name: c.name,
    count: obs.filter((o) => o.cameraId === c.id).length,
  }));
}

export function speedByHour(until: number) {
  const buckets = Array.from({ length: 17 }, (_, i) => ({
    hour: `${String(6 + i).padStart(2, "0")}:00`,
    kmh: 0,
    n: 0,
  }));
  for (const traj of TRAJECTORIES) {
    for (const hop of traj.hops) {
      if (hop.end > until) continue;
      const idx = Math.floor((hop.end - opsDayStart(until)) / 3_600_000);
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx].kmh += (hop.km / Math.max(hop.observedMin, 0.4)) * 60;
      buckets[idx].n += 1;
    }
  }
  return buckets.map((b) => ({ hour: b.hour, kmh: b.n ? Number((b.kmh / b.n).toFixed(1)) : 0 }));
}

export function odMatrix(until: number) {
  const ids = CAMERAS.map((c) => c.id);
  const grid: Record<string, number> = {};
  for (const a of ids) for (const b of ids) grid[`${a}|${b}`] = 0;

  for (const traj of TRAJECTORIES) {
    const seq = traj.observations.filter((o) => o.timestamp <= until);
    if (seq.length < 2) continue;
    const trips: Observation[][] = [];
    let cur: Observation[] = [seq[0]];
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].timestamp - seq[i - 1].timestamp > 75 * 60_000) {
        trips.push(cur);
        cur = [seq[i]];
      } else cur.push(seq[i]);
    }
    trips.push(cur);
    for (const trip of trips) {
      if (trip.length < 2) continue;
      grid[`${trip[0].cameraId}|${trip[trip.length - 1].cameraId}`] += 1;
    }
  }
  return { ids, grid };
}

export function avgSpeedUntil(until: number) {
  const hops = TRAJECTORIES.flatMap((t) => t.hops).filter((h) => h.end <= until);
  if (!hops.length) return 0;
  return hops.reduce((s, h) => s + (h.km / Math.max(h.observedMin, 0.4)) * 60, 0) / hops.length;
}

export function peakHourLabel(obs: Observation[], now?: number) {
  const hourly = hourlyVolume(obs, now);
  const peak = hourly.reduce((a, b) => (b.count > a.count ? b : a), hourly[0]);
  return peak?.count ? peak.hour : "—";
}

export function recentFeed(obs: Observation[], limit = 12) {
  return [...obs].slice(-limit).reverse();
}

export const CAMERA_SHORT: Record<CameraId, string> = {
  CAM_011: "BADA",
  CAM_015: "KAMP",
  CAM_023: "JN",
  CAM_028: "NAZR",
  CAM_034: "LASH",
  CAM_042: "PHOOL",
  CAM_049: "PADV",
  CAM_057: "CITY",
  CAM_062: "GOLE",
  CAM_076: "DDN",
  CAM_081: "THAT",
  CAM_103: "AIR",
};
