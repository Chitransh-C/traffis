import roadPathsJson from "./road-paths.json";
import type { Alert, Camera, Meta, Observation, Vehicle } from "../types";

type RoadPaths = {
  corridors: Record<string, [number, number][]>;
  arteries: Record<string, [number, number][]>;
};

export const CAMERAS: Camera[] = [];
export const VEHICLES: Vehicle[] = [];
export const OBSERVATIONS: Observation[] = [];
export const ALERTS: Alert[] = [];
export const META: Meta = {
  city: "Gwalior",
  state: "Madhya Pradesh",
  center: [26.2183, 78.1828],
  zoom: 12.55,
  dayStart: 0,
  dayEnd: 0,
  dateLabel: "",
};
export const CAMERA_MAP: Record<string, Camera> = {};
export const VEHICLE_MAP: Record<string, Vehicle> = {};
export const VEHICLE_BY_PLATE: Record<string, Vehicle> = {};
export const ROAD_PATHS = roadPathsJson as unknown as RoadPaths;

function replace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

function replaceMap<T>(target: Record<string, T>, next: Record<string, T>) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, next);
}

export type BootstrapPayload = {
  cameras: Camera[];
  vehicles: Vehicle[];
  observations: Observation[];
  alerts: Alert[];
  meta: Meta;
  counts?: { cameras: number; vehicles: number; observations: number; alerts: number };
};

export function hydrate(data: BootstrapPayload) {
  replace(CAMERAS, data.cameras);
  replace(VEHICLES, data.vehicles);
  replace(OBSERVATIONS, data.observations);
  replace(ALERTS, data.alerts);
  Object.assign(META, data.meta);
  replaceMap(CAMERA_MAP, Object.fromEntries(CAMERAS.map((c) => [c.id, c])));
  replaceMap(VEHICLE_MAP, Object.fromEntries(VEHICLES.map((v) => [v.id, v])));
  replaceMap(VEHICLE_BY_PLATE, Object.fromEntries(VEHICLES.map((v) => [v.plate, v])));
}

export async function loadFromApi() {
  const res = await fetch("/api/bootstrap");
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = (await res.json()) as BootstrapPayload;
  hydrate(data);
  return data;
}

export function roadPathBetween(a: string, b: string): [number, number][] | null {
  const key = [a, b].sort().join("|");
  const path = ROAD_PATHS.corridors[key];
  if (!path?.length) return null;
  const start = CAMERA_MAP[a];
  if (!start) return path;
  const first = path[0];
  const last = path[path.length - 1];
  const toFirst = Math.hypot(first[0] - start.lat, first[1] - start.lng);
  const toLast = Math.hypot(last[0] - start.lat, last[1] - start.lng);
  return toFirst <= toLast ? path : [...path].reverse();
}
