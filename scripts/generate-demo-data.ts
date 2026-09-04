import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "data");

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260911);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const rng = (a: number, b: number) => a + rand() * (b - a);

const cameras = [
  { id: "CAM_011", name: "Maharaj Bada", corridor: "Old city loop", lat: 26.2216, lng: 78.1789, direction: "SOUTH", lanes: 3, status: "online" },
  { id: "CAM_015", name: "Kampoo", corridor: "Kampoo Road", lat: 26.2174, lng: 78.1718, direction: "EAST", lanes: 3, status: "online" },
  { id: "CAM_023", name: "Gwalior Junction", corridor: "Station approach", lat: 26.2151, lng: 78.1822, direction: "EAST", lanes: 4, status: "online" },
  { id: "CAM_028", name: "Nazar Bagh", corridor: "City Centre south", lat: 26.2132, lng: 78.1894, direction: "NORTH", lanes: 3, status: "online" },
  { id: "CAM_034", name: "Lashkar", corridor: "Lashkar market", lat: 26.2058, lng: 78.1688, direction: "NORTH", lanes: 3, status: "online" },
  { id: "CAM_042", name: "Phoolbagh", corridor: "Race Course Road", lat: 26.2082, lng: 78.1756, direction: "NORTH", lanes: 3, status: "online" },
  { id: "CAM_049", name: "Padav Pul", corridor: "Padav", lat: 26.2106, lng: 78.1858, direction: "WEST", lanes: 3, status: "online" },
  { id: "CAM_057", name: "City Centre", corridor: "NH-44 / City Centre", lat: 26.2184, lng: 78.1938, direction: "WEST", lanes: 4, status: "online" },
  { id: "CAM_062", name: "Gole ka Mandir", corridor: "Gole ka Mandir Rd", lat: 26.2272, lng: 78.1876, direction: "SOUTH", lanes: 3, status: "online" },
  { id: "CAM_076", name: "DD Nagar", corridor: "University west", lat: 26.2254, lng: 78.1988, direction: "EAST", lanes: 3, status: "online" },
  { id: "CAM_081", name: "Thatipur Crossing", corridor: "University Road", lat: 26.2312, lng: 78.2071, direction: "SOUTH", lanes: 3, status: "degraded" },
  { id: "CAM_103", name: "Airport Road", corridor: "AB Road west", lat: 26.2241, lng: 78.1688, direction: "EAST", lanes: 3, status: "online" },
] as const;

type CamId = (typeof cameras)[number]["id"];
const CAM = Object.fromEntries(cameras.map((c) => [c.id, c])) as Record<CamId, (typeof cameras)[number]>;
const CAM_IDS = cameras.map((c) => c.id);

export const GRAPH: Record<CamId, CamId[]> = {
  CAM_011: ["CAM_023", "CAM_015", "CAM_062", "CAM_103"],
  CAM_015: ["CAM_011", "CAM_103", "CAM_042"],
  CAM_023: ["CAM_011", "CAM_042", "CAM_049", "CAM_028"],
  CAM_028: ["CAM_023", "CAM_057", "CAM_049"],
  CAM_034: ["CAM_042", "CAM_103"],
  CAM_042: ["CAM_023", "CAM_015", "CAM_034", "CAM_049"],
  CAM_049: ["CAM_023", "CAM_042", "CAM_028"],
  CAM_057: ["CAM_028", "CAM_062", "CAM_076", "CAM_081"],
  CAM_062: ["CAM_011", "CAM_057", "CAM_076"],
  CAM_076: ["CAM_057", "CAM_062", "CAM_081"],
  CAM_081: ["CAM_057", "CAM_076"],
  CAM_103: ["CAM_011", "CAM_015", "CAM_034"],
};

function shortest(from: CamId, to: CamId): CamId[] {
  if (from === to) return [from];
  const q: CamId[][] = [[from]];
  const seen = new Set<CamId>([from]);
  while (q.length) {
    const path = q.shift()!;
    const cur = path[path.length - 1];
    for (const n of GRAPH[cur]) {
      if (seen.has(n)) continue;
      const next = [...path, n];
      if (n === to) return next;
      seen.add(n);
      q.push(next);
    }
  }
  return [from, to];
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const COLORS = ["White", "Silver", "Black", "Red", "Blue", "Grey", "Maroon"] as const;
const PREFIX = ["MP07", "MP07", "MP07", "MP04", "MP09"] as const;
const LETTERS = "ABCFHJKLMPRTV";

function plate() {
  const letters = `${pick(LETTERS.split(""))}${pick(LETTERS.split(""))}`;
  return `${pick(PREFIX)}${letters}${String(Math.floor(rng(1100, 9899)))}`;
}

type Kind = "car" | "bike" | "truck";
type Profile = "commuter" | "local" | "occasional" | "fleet";

function typeFor(i: number): Kind {
  if (i < 48) return "car";
  if (i < 80) return "bike";
  return "truck";
}

function profileFor(kind: Kind, i: number): Profile {
  if (kind === "truck") return "fleet";
  if (kind === "bike") return i % 3 === 0 ? "commuter" : "local";
  if (i % 7 === 0) return "occasional";
  return "commuter";
}

function hint(kind: Kind, profile: Profile) {
  if (kind === "truck") return pick(["Logistics fleet", "Wholesale supply", "Construction haul"]);
  if (kind === "bike") return profile === "commuter" ? "Daily commuter" : pick(["Delivery rider", "Local two-wheeler"]);
  if (profile === "occasional") return "Private / irregular";
  return pick(["Private commuter", "App taxi", "Office pool"]);
}

const vehicles = Array.from({ length: 100 }, (_, i) => {
  const type = typeFor(i);
  const profile = profileFor(type, i);
  return {
    id: `V${String(i + 1).padStart(3, "0")}`,
    plate: i === 0 ? "MP07WL0001" : i === 1 ? "MP04ST3344" : i === 2 ? "MP07TR8821" : plate(),
    type,
    color: pick(COLORS),
    watchlist: i < 3,
    ownerHint: hint(type, profile),
    profile,
    home: CAM_IDS[i % CAM_IDS.length],
    work: CAM_IDS[(i * 5 + 3) % CAM_IDS.length] === CAM_IDS[i % CAM_IDS.length]
      ? CAM_IDS[(i + 4) % CAM_IDS.length]
      : CAM_IDS[(i * 5 + 3) % CAM_IDS.length],
  };
});

const observations: Array<Record<string, unknown>> = [];
const alerts: Array<Record<string, unknown>> = [];
let obsN = 0;
let alN = 0;
const watchDay = new Set<string>();

function addAlert(partial: Record<string, unknown>) {
  alerts.push({ id: `AL_${++alN}`, ...partial });
}

const confuse: Record<string, string> = { "8": "B", B: "8", "0": "O", O: "0", "1": "I" };
const DAY_MS = 24 * 60 * 60_000;
const OPS = 16 * 60 * 60_000;

function istTodayIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Last complete 7 days ending yesterday — never includes today or the future. */
const WEEK_START = Date.parse(`${istTodayIso()}T00:30:00.000Z`) - 7 * DAY_MS;

function utcWeekday(dayStart: number) {
  return new Date(dayStart).getUTCDay();
}
function isWeekend(dayStart: number) {
  const w = utcWeekday(dayStart);
  return w === 0 || w === 6;
}

function activeChance(profile: Profile, dayStart: number, kind: Kind) {
  const weekend = isWeekend(dayStart);
  if (profile === "fleet") return utcWeekday(dayStart) === 0 ? 0.18 : 0.82;
  if (profile === "occasional") return weekend ? 0.28 : 0.38;
  if (profile === "local") return weekend ? 0.55 : 0.72;
  if (kind === "bike") return weekend ? 0.45 : 0.88;
  return weekend ? 0.35 : 0.9;
}

function tripsFor(profile: Profile, kind: Kind, dayStart: number) {
  const weekend = isWeekend(dayStart);
  if (profile === "fleet") return weekend ? 1 : 2 + (rand() < 0.35 ? 1 : 0);
  if (profile === "local") return 1 + (rand() < 0.5 ? 1 : 0) + (rand() < 0.2 ? 1 : 0);
  if (profile === "occasional") return 1;
  if (weekend) return rand() < 0.6 ? 1 : 2;
  return 2 + (rand() < 0.15 ? 1 : 0);
}

function startMinute(profile: Profile, trip: number, kind: Kind, dayStart: number) {
  const weekend = isWeekend(dayStart);
  if (profile === "fleet") return trip === 0 ? rng(6 * 60 + 20, 8 * 60) : rng(13 * 60, 17 * 60 + 30);
  if (kind === "bike" && profile === "local") return rng(7 * 60, 20 * 60);
  if (weekend) return rng(9 * 60, 18 * 60);
  if (trip === 0) return rng(7 * 60 + 10, 9 * 60 + 40);
  if (trip === 1) return rng(17 * 60, 19 * 60 + 40);
  return rng(11 * 60, 15 * 60);
}

function emitTrip(v: (typeof vehicles)[number], dayStart: number, route: CamId[], minute: number, speedKmh: number) {
  let cursor = minute;
  for (let i = 0; i < route.length; i++) {
    const cam = CAM[route[i]];
    const miss = i > 0 && i < route.length - 1 && rand() < 0.12;
    const mins = cursor;
    const offline = cam.id === "CAM_081" && mins >= 14 * 60 && mins <= 15 * 60 + 20 && rand() < 0.7;
    if (!miss && !offline && mins < 22 * 60) {
      const confidence = Number(rng(0.86, 0.995).toFixed(3));
      let rawPlate = v.plate;
      if (rand() < 0.025) rawPlate = v.plate.replace(/8|B|0|O|1/, (ch) => confuse[ch] ?? ch);
      const ts = dayStart + (mins - 6 * 60) * 60_000;
      observations.push({
        id: `OBS_${++obsN}`,
        vehicleId: v.id,
        plate: rawPlate,
        canonicalPlate: v.plate,
        confidence,
        cameraId: cam.id,
        timestamp: ts,
        lat: cam.lat,
        lng: cam.lng,
        direction: cam.direction,
        vehicleType: v.type,
      });
      if (confidence < 0.89 && rand() < 0.35) {
        addAlert({
          level: "info",
          title: "Low OCR confidence",
          detail: `${rawPlate} at ${cam.id} · ${(confidence * 100).toFixed(1)}%`,
          timestamp: ts,
          plate: v.plate,
          cameraId: cam.id,
        });
      }
      const wkey = `${v.id}:${dayStart}`;
      if (v.watchlist && !watchDay.has(wkey)) {
        watchDay.add(wkey);
        addAlert({
          level: "critical",
          title: "Watchlist plate",
          detail: `${v.plate} observed at ${cam.name}`,
          timestamp: ts,
          plate: v.plate,
          cameraId: cam.id,
        });
      }
    }
    if (i < route.length - 1) {
      const a = CAM[route[i]];
      const b = CAM[route[i + 1]];
      const km = haversineKm(a, b);
      const expected = Math.max(2.4, (km / speedKmh) * 60);
      const travel = expected * rng(0.85, 1.4);
      cursor += travel;
      if (rand() < 0.012) {
        addAlert({
          level: "warn",
          title: "Implausible transit",
          detail: `${v.plate} ${a.id} → ${b.id} faster than road estimate`,
          timestamp: dayStart + (cursor - 6 * 60) * 60_000,
          plate: v.plate,
        });
      }
    }
  }
  return cursor;
}

for (let d = 0; d < 7; d++) {
  const dayStart = WEEK_START + d * DAY_MS;
  for (const v of vehicles) {
    if (rand() > activeChance(v.profile, dayStart, v.type)) continue;
    const nTrips = tripsFor(v.profile, v.type, dayStart);
    const speed = v.type === "bike" ? rng(22, 32) : v.type === "truck" ? rng(18, 26) : rng(24, 36);
    let lastEnd = 6 * 60;
    for (let t = 0; t < nTrips; t++) {
      let minute = Math.max(lastEnd + 25, startMinute(v.profile, t, v.type, dayStart));
      if (minute > 21 * 60) break;
      const outbound = t % 2 === 0;
      const from = outbound ? v.home : v.work;
      const to = outbound ? v.work : v.home;
      let route = shortest(from, to);
      if (v.type === "bike" && route.length > 4 && rand() < 0.4) route = route.slice(0, 3);
      if (v.profile === "local") {
        const start = pick(GRAPH[v.home]);
        route = shortest(v.home, start);
        if (rand() < 0.5) route = [...route, pick(GRAPH[route[route.length - 1]])];
      }
      if (v.type === "truck" && rand() < 0.45) {
        const extra = pick(CAM_IDS.filter((id) => id !== from && id !== to));
        route = [...shortest(from, extra), ...shortest(extra, to).slice(1)];
      }
      lastEnd = emitTrip(v, dayStart, route, minute, speed);
    }
  }
  if (utcWeekday(dayStart) !== 0) {
    addAlert({
      level: "warn",
      title: "Corridor saturation",
      detail: `${pick(["Thatipur Crossing", "Gwalior Junction", "City Centre"])} evening peak`,
      timestamp: dayStart + (12 * 60 + rng(0, 40)) * 60_000,
      cameraId: pick(["CAM_081", "CAM_023", "CAM_057"]),
    });
  }
}

addAlert({
  level: "warn",
  title: "Camera degraded",
  detail: "CAM_081 Thatipur intermittent FOV drop 14:00–15:20 most weekdays",
  timestamp: WEEK_START + 8 * 60 * 60_000,
  cameraId: "CAM_081",
});

observations.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
alerts.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

const days = Array.from({ length: 7 }, (_, i) => {
  const start = WEEK_START + i * DAY_MS;
  const label = new Date(start).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const iso = new Date(start).toISOString().slice(0, 10);
  return { iso, start, end: start + OPS, label, weekday: utcWeekday(start) };
});
const dateLabel = `${days[0].label} – ${days[6].label}`;

const publicVehicles = vehicles.map(({ profile: _p, home: _h, work: _w, ...row }) => row);

const meta = {
  city: "Gwalior",
  state: "Madhya Pradesh",
  sector: "Lashkar–Junction–City Centre",
  center: [26.217, 78.185],
  zoom: 13.15,
  weekStart: WEEK_START,
  weekEnd: WEEK_START + 7 * DAY_MS,
  dayStart: WEEK_START,
  dayEnd: WEEK_START + OPS,
  dateLabel,
  days,
};

mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) =>
  writeFileSync(join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);

write("cameras.json", cameras);
write("vehicles.json", publicVehicles);
write("observations.json", observations);
write("alerts.json", alerts);
write("meta.json", meta);
write(
  "network.json",
  {
    graph: GRAPH,
    labels: {
      "CAM_011|CAM_015": "Bada – Kampoo",
      "CAM_011|CAM_023": "Bada – Junction",
      "CAM_011|CAM_062": "Bada – Gole ka Mandir",
      "CAM_011|CAM_103": "Airport approach",
      "CAM_015|CAM_042": "Kampoo – Phoolbagh",
      "CAM_015|CAM_103": "Kampoo – Airport Rd",
      "CAM_023|CAM_028": "Junction – Nazar Bagh",
      "CAM_023|CAM_042": "Station – Phoolbagh",
      "CAM_023|CAM_049": "Junction – Padav",
      "CAM_028|CAM_049": "Nazar Bagh – Padav",
      "CAM_028|CAM_057": "Nazar Bagh – City Centre",
      "CAM_034|CAM_042": "Lashkar – Phoolbagh",
      "CAM_034|CAM_103": "Lashkar – Airport Rd",
      "CAM_042|CAM_049": "Phoolbagh – Padav",
      "CAM_057|CAM_062": "City Centre – Gole ka Mandir",
      "CAM_057|CAM_076": "City Centre – DD Nagar",
      "CAM_057|CAM_081": "University Rd",
      "CAM_062|CAM_076": "Gole ka Mandir – DD Nagar",
      "CAM_076|CAM_081": "DD Nagar – Thatipur",
    },
    edges: {
      "CAM_011|CAM_015": { class: "narrow", lanes: 2, truckOk: false, label: "Bada – Kampoo" },
      "CAM_011|CAM_023": { class: "corridor", lanes: 3, truckOk: true, label: "Bada – Junction" },
      "CAM_011|CAM_062": { class: "corridor", lanes: 3, truckOk: true, label: "Bada – Gole ka Mandir" },
      "CAM_011|CAM_103": { class: "arterial", lanes: 3, truckOk: true, label: "Airport approach" },
      "CAM_015|CAM_042": { class: "market", lanes: 2, truckOk: true, label: "Kampoo – Phoolbagh" },
      "CAM_015|CAM_103": { class: "arterial", lanes: 3, truckOk: true, label: "Kampoo – Airport Rd" },
      "CAM_023|CAM_028": { class: "corridor", lanes: 3, truckOk: true, label: "Junction – Nazar Bagh" },
      "CAM_023|CAM_042": { class: "corridor", lanes: 3, truckOk: true, label: "Station – Phoolbagh" },
      "CAM_023|CAM_049": { class: "corridor", lanes: 3, truckOk: true, label: "Junction – Padav" },
      "CAM_028|CAM_049": { class: "market", lanes: 2, truckOk: true, label: "Nazar Bagh – Padav" },
      "CAM_028|CAM_057": { class: "arterial", lanes: 4, truckOk: true, label: "Nazar Bagh – City Centre" },
      "CAM_034|CAM_042": { class: "market", lanes: 2, truckOk: false, label: "Lashkar – Phoolbagh" },
      "CAM_034|CAM_103": { class: "narrow", lanes: 2, truckOk: false, label: "Lashkar – Airport Rd" },
      "CAM_042|CAM_049": { class: "corridor", lanes: 3, truckOk: true, label: "Phoolbagh – Padav" },
      "CAM_057|CAM_062": { class: "arterial", lanes: 4, truckOk: true, label: "City Centre – Gole ka Mandir" },
      "CAM_057|CAM_076": { class: "arterial", lanes: 3, truckOk: true, label: "City Centre – DD Nagar" },
      "CAM_057|CAM_081": { class: "corridor", lanes: 3, truckOk: true, label: "University Rd" },
      "CAM_062|CAM_076": { class: "corridor", lanes: 3, truckOk: true, label: "Gole ka Mandir – DD Nagar" },
      "CAM_076|CAM_081": { class: "corridor", lanes: 3, truckOk: true, label: "DD Nagar – Thatipur" },
    },
  },
);

console.log(
  `Wrote ${cameras.length} cameras, ${publicVehicles.length} vehicles, ${observations.length} observations, ${alerts.length} alerts, ${days.length} days`,
);
