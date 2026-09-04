import networkJson from "../data/network.json";
import { CAMERA_MAP, roadPathBetween } from "../data/load";
import { haversineKm, pathLengthKm } from "./geo";
import type {
  CameraId,
  LastSeenZone,
  Observation,
  RouteBand,
  RouteHypothesis,
  RouteKind,
  Vehicle,
  VehicleType,
} from "../types";

type EdgeClass = "arterial" | "corridor" | "market" | "narrow";
type EdgeMeta = { class: EdgeClass; lanes: number; truckOk: boolean; label: string };

const GRAPH = networkJson.graph as Record<string, string[]>;
const EDGES = (networkJson as { edges?: Record<string, EdgeMeta> }).edges ?? {};

const MAX_HOPS = 4;
const MAX_PATHS = 6;

export function edgeKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

export function edgeMeta(a: string, b: string): EdgeMeta {
  return (
    EDGES[edgeKey(a, b)] ?? {
      class: "corridor",
      lanes: 3,
      truckOk: true,
      label: `${a} – ${b}`,
    }
  );
}

export function enumeratePaths(from: CameraId, to: CameraId, maxHops = MAX_HOPS, cap = MAX_PATHS): CameraId[][] {
  if (from === to) return [];
  const found: CameraId[][] = [];
  const walk = (cur: CameraId, trail: CameraId[], hops: number) => {
    if (found.length >= cap * 3) return;
    if (cur === to && trail.length > 1) {
      found.push([...trail]);
      return;
    }
    if (hops >= maxHops) return;
    for (const next of GRAPH[cur] ?? []) {
      if (trail.includes(next)) continue;
      trail.push(next);
      walk(next, trail, hops + 1);
      trail.pop();
    }
  };
  walk(from, [from], 0);
  return found
    .sort((a, b) => pathKm(a) - pathKm(b) || a.length - b.length)
    .slice(0, cap);
}

function stitch(cameras: CameraId[]): [number, number][] {
  const line: [number, number][] = [];
  for (let i = 0; i < cameras.length; i++) {
    const cam = CAMERA_MAP[cameras[i]];
    if (!cam) continue;
    if (i === 0) {
      line.push([cam.lat, cam.lng]);
      continue;
    }
    const road = roadPathBetween(cameras[i - 1], cameras[i]);
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

function pathKm(cameras: CameraId[]) {
  let km = 0;
  for (let i = 1; i < cameras.length; i++) {
    const road = roadPathBetween(cameras[i - 1], cameras[i]);
    if (road && road.length > 1) km += pathLengthKm(road);
    else {
      const a = CAMERA_MAP[cameras[i - 1]];
      const b = CAMERA_MAP[cameras[i]];
      if (a && b) km += haversineKm([a.lat, a.lng], [b.lat, b.lng]);
    }
  }
  return km;
}

function istHour(ts: number) {
  return Number(
    new Date(ts).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }),
  );
}

function isPeak(hour: number) {
  return (hour >= 8 && hour < 10) || (hour >= 17 && hour < 20);
}

function cruiseKmh(type: VehicleType, cls: EdgeClass, peak: boolean) {
  let base = type === "bike" ? 28 : type === "truck" || type === "bus" ? 22 : 30;
  if (cls === "narrow" || cls === "market") base *= 0.75;
  if (peak && (cls === "arterial" || cls === "corridor")) base /= 1.35;
  return Math.max(10, base);
}

function expectedMin(cameras: CameraId[], type: VehicleType, hour: number) {
  let min = 0;
  const peak = isPeak(hour);
  for (let i = 1; i < cameras.length; i++) {
    const meta = edgeMeta(cameras[i - 1], cameras[i]);
    const road = roadPathBetween(cameras[i - 1], cameras[i]);
    const a = CAMERA_MAP[cameras[i - 1]];
    const b = CAMERA_MAP[cameras[i]];
    const km = road && road.length > 1 ? pathLengthKm(road) : a && b ? haversineKm([a.lat, a.lng], [b.lat, b.lng]) : 0.4;
    min += (km / cruiseKmh(type, meta.class, peak)) * 60;
  }
  return Math.max(1.2, min);
}

function bandFor(p: number, blocked: boolean): RouteBand {
  if (blocked) return "blocked";
  if (p >= 0.45) return "likely";
  if (p >= 0.2) return "possible";
  return "unlikely";
}

export function bandColor(band: RouteBand) {
  if (band === "likely") return "#0891b2";
  if (band === "possible") return "#d97706";
  if (band === "blocked") return "#64748b";
  return "#e11d48";
}

export function topHypothesis(list: RouteHypothesis[]) {
  return list.find((h) => !h.blocked) ?? list[0] ?? null;
}

export function hyposByHop(all: RouteHypothesis[]) {
  const map = new Map<number, RouteHypothesis[]>();
  for (const h of all) {
    const row = map.get(h.hopIndex) ?? [];
    row.push(h);
    map.set(h.hopIndex, row);
  }
  return map;
}

/** Default map: top + likely/possible. All-paths: full set only on the focused hop. */
export function visibleHypotheses(
  all: RouteHypothesis[],
  showAll: boolean,
  focusHop: number,
): RouteHypothesis[] {
  const grouped = hyposByHop(all);
  const out: RouteHypothesis[] = [];
  for (const [hop, list] of grouped) {
    const top = topHypothesis(list);
    if (showAll && hop === focusHop) {
      out.push(...list);
      continue;
    }
    if (!showAll) {
      for (const h of list) {
        if (h === top || h.band === "likely" || h.band === "possible") out.push(h);
      }
      continue;
    }
    if (top) out.push(top);
  }
  return out;
}

export function hypothesesForHop(
  prev: Observation,
  next: Observation,
  vehicle: Vehicle,
  hopIndex: number,
): RouteHypothesis[] {
  const from = prev.cameraId;
  const to = next.cameraId;
  const raw = enumeratePaths(from, to);
  if (!raw.length) {
    raw.push([from, to]);
  }
  const observedMin = Math.max(0.4, (next.timestamp - prev.timestamp) / 60_000);
  const hour = istHour(prev.timestamp);
  const shortestKm = Math.min(...raw.map(pathKm));
  const type = vehicle.type;

  const scored = raw.map((cameras, i) => {
    const km = pathKm(cameras);
    const est = expectedMin(cameras, type, hour);
    const skipped = cameras.slice(1, -1);
    const reasons: string[] = [];
    let blocked = false;
    let cost = 0;

    for (let e = 1; e < cameras.length; e++) {
      const meta = edgeMeta(cameras[e - 1], cameras[e]);
      const heavy = type === "truck" || type === "bus";
      if (heavy && (!meta.truckOk || meta.class === "narrow" || meta.lanes < 2)) {
        blocked = true;
        reasons.push(`truck blocked on ${meta.label}`);
      }
      if (type === "bike" && (meta.class === "narrow" || meta.class === "market")) {
        cost -= 0.28;
        reasons.push(`bike favours ${meta.class} ${meta.label}`);
      }
    }

    const ratio = observedMin / est;
    cost += Math.abs(ratio - 1) * 2.1;
    cost += km * 0.12;
    if (ratio < 0.45) reasons.push("faster than this path allows");
    else if (ratio > 2.2) reasons.push("slower than free-flow on this path");
    else reasons.push(`time fits (~${est.toFixed(0)} min expected, ${observedMin.toFixed(0)} observed)`);

    let kind: RouteKind = "direct";
    if (skipped.length) {
      const missLike = km <= shortestKm * 1.15;
      kind = missLike ? "miss" : "alternate";
      for (const id of skipped) {
        const cam = CAMERA_MAP[id];
        const degraded = cam?.status === "degraded";
        cost += degraded ? 0.08 : 0.28;
        if (degraded) {
          reasons.push(`${cam?.name ?? id} degraded — miss more likely`);
        } else if (missLike) {
          reasons.push(`silent ${cam?.name ?? id} — possible missed capture`);
        } else {
          reasons.push(`avoids ${cam?.name ?? id} — alternate corridor`);
        }
      }
    } else {
      reasons.push("direct neighbor hop");
    }

    if (isPeak(hour)) reasons.push("peak-hour arterial slowdown applied");
    if (blocked) cost = 80;

    return { cameras, km, est, skipped, reasons: [...new Set(reasons)], blocked, cost, kind, i };
  });

  const live = scored.filter((s) => !s.blocked);
  const pool = live.length ? live : scored;
  const exps = pool.map((s) => Math.exp(-s.cost));
  const z = exps.reduce((a, b) => a + b, 0) || 1;

  return scored
    .map((s) => {
      const p = s.blocked ? 0 : Math.exp(-s.cost) / z;
      const band = bandFor(p, s.blocked);
      const rawPath = stitch(s.cameras);
      return {
        id: `h${hopIndex}-${s.cameras.join("-")}`,
        hopIndex,
        cameras: s.cameras,
        path: rawPath,
        km: Number(s.km.toFixed(2)),
        estMin: Number(s.est.toFixed(1)),
        observedMin: Number(observedMin.toFixed(1)),
        p: Number(p.toFixed(3)),
        color: bandColor(band),
        band,
        kind: s.kind,
        reasons: s.reasons,
        skipped: s.skipped,
        blocked: s.blocked,
        fromTs: prev.timestamp,
        toTs: next.timestamp,
      } satisfies RouteHypothesis;
    })
    .sort((a, b) => b.p - a.p);
}

export function lastSeenZone(last: Observation, vehicle: Vehicle, asOf: number): LastSeenZone | null {
  const cam = CAMERA_MAP[last.cameraId];
  if (!cam) return null;
  const rawElapsed = Math.max(0, (Math.max(asOf, last.timestamp) - last.timestamp) / 60_000);
  const ringMin = Math.min(4, Math.max(1, rawElapsed));
  const hour = istHour(last.timestamp);
  const reachable = (GRAPH[last.cameraId] ?? [])
    .map((id) => {
      const next = CAMERA_MAP[id];
      if (!next) return null;
      const meta = edgeMeta(last.cameraId, id);
      if ((vehicle.type === "truck" || vehicle.type === "bus") && (!meta.truckOk || meta.class === "narrow")) {
        return null;
      }
      const km = pathKm([last.cameraId, id]);
      const est = expectedMin([last.cameraId, id], vehicle.type, hour);
      return { id, name: next.name, km: Number(km.toFixed(2)), estMin: Number(est.toFixed(1)) };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.estMin - b.estMin);

  return {
    cameraId: cam.id,
    name: cam.name,
    lat: cam.lat,
    lng: cam.lng,
    lastTs: last.timestamp,
    asOf: Math.max(asOf, last.timestamp),
    elapsedMin: Number(rawElapsed.toFixed(1)),
    likelyRadiusM: 160 + ringMin * 30,
    possibleRadiusM: 240 + ringMin * 40,
    reachable,
  };
}

export function hypothesesForTrack(hits: Observation[], vehicle: Vehicle): RouteHypothesis[] {
  const out: RouteHypothesis[] = [];
  for (let i = 1; i < hits.length; i++) {
    if (hits[i].cameraId === hits[i - 1].cameraId) continue;
    out.push(...hypothesesForHop(hits[i - 1], hits[i], vehicle, i - 1));
  }
  return out;
}

/** Distance-weighted timestamp along a hypothesis polyline. */
export function timeAtFraction(h: RouteHypothesis, t: number) {
  const u = Math.min(1, Math.max(0, t));
  return h.fromTs + (h.toTs - h.fromTs) * u;
}

export function nearestTimeOnPath(h: RouteHypothesis, lat: number, lng: number) {
  if (h.path.length < 2) return h.fromTs;
  let best = 0;
  let bestD = Infinity;
  let walked = 0;
  const total = pathLengthKm(h.path) || 1;
  for (let i = 1; i < h.path.length; i++) {
    const a = h.path[i - 1];
    const b = h.path[i];
    const seg = pathLengthKm([a, b]) || 0.0001;
    const midLat = (a[0] + b[0]) / 2;
    const midLng = (a[1] + b[1]) / 2;
    const d = (midLat - lat) ** 2 + (midLng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = (walked + seg / 2) / total;
    }
    walked += seg;
  }
  return timeAtFraction(h, best);
}

export function estTimeAtCamera(h: RouteHypothesis, cameraId: CameraId) {
  const idx = h.cameras.indexOf(cameraId);
  if (idx <= 0) return h.fromTs;
  if (idx === h.cameras.length - 1) return h.toTs;
  const before = pathKm(h.cameras.slice(0, idx + 1));
  const all = pathKm(h.cameras) || 1;
  return timeAtFraction(h, before / all);
}
