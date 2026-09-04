import { CAMERA_MAP, OBSERVATIONS, VEHICLES, roadPathBetween } from "../data/load";
import type { Observation, Vehicle } from "../types";

export function plateKey(s: string) {
  return s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export function plateMatches(plate: string, query: string) {
  const p = plateKey(plate);
  const n = plateKey(query);
  if (!n) return false;
  if (p.includes(n) || n.includes(p)) return true;
  const pz = p.replace(/0/g, "");
  const nz = n.replace(/0/g, "");
  return nz.length >= 3 && (pz.includes(nz) || nz.includes(pz));
}

export function matchVehicles(query: string): Vehicle[] {
  const n = plateKey(query);
  if (!n) return [];
  return VEHICLES.filter(
    (v) => plateMatches(v.plate, n) || plateMatches(v.id, n),
  ).sort((a, b) => a.plate.localeCompare(b.plate));
}

export function hitsInWindow(vehicleId: string, from: number, to: number): Observation[] {
  return OBSERVATIONS.filter(
    (o) => o.vehicleId === vehicleId && o.timestamp >= from && o.timestamp <= to,
  ).sort((a, b) => a.timestamp - b.timestamp);
}

export function hitsOnIsoDay(vehicleId: string, isoDate: string): Observation[] {
  const start = Date.parse(`${isoDate}T00:00:00+05:30`);
  const end = Date.parse(`${isoDate}T23:59:59+05:30`);
  return hitsInWindow(vehicleId, start, end);
}

export function trackPath(hits: Observation[]): [number, number][] {
  const line: [number, number][] = [];
  for (let i = 0; i < hits.length; i++) {
    const cam = CAMERA_MAP[hits[i].cameraId];
    if (!cam) continue;
    if (i === 0) {
      line.push([cam.lat, cam.lng]);
      continue;
    }
    const prev = hits[i - 1];
    const road = roadPathBetween(prev.cameraId, hits[i].cameraId);
    if (road?.length) {
      const last = line[line.length - 1];
      const first = road[0];
      if (last && first[0] === last[0] && first[1] === last[1]) line.push(...road.slice(1));
      else line.push(...road);
    } else {
      line.push([cam.lat, cam.lng]);
    }
  }
  return line;
}
