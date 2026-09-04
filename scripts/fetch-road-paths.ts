import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cameras = JSON.parse(readFileSync(join(root, "src", "data", "cameras.json"), "utf8")) as {
  id: string;
  lat: number;
  lng: number;
}[];
const network = JSON.parse(readFileSync(join(root, "src", "data", "network.json"), "utf8")) as {
  graph: Record<string, string[]>;
};

const byId = Object.fromEntries(cameras.map((c) => [c.id, c]));
const pairs = new Set<string>();
for (const [a, nexts] of Object.entries(network.graph)) {
  for (const b of nexts) pairs.add([a, b].sort().join("|"));
}

async function route(points: [number, number][]) {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = (await res.json()) as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
  return (json.routes?.[0]?.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const corridors: Record<string, [number, number][]> = {};
for (const key of [...pairs].sort()) {
  const [a, b] = key.split("|");
  corridors[key] = await route([
    [byId[a].lat, byId[a].lng],
    [byId[b].lat, byId[b].lng],
  ]);
  console.log(key, corridors[key].length);
  await sleep(160);
}

const extras = [
  { id: "race-course", via: [[26.2082, 78.1756], [26.214, 78.172], [26.2241, 78.1688]] as [number, number][] },
  { id: "station-loop", via: [[26.2151, 78.1822], [26.212, 78.186], [26.2184, 78.1938]] as [number, number][] },
];
const arteries: Record<string, [number, number][]> = {};
for (const extra of extras) {
  arteries[extra.id] = await route(extra.via);
  console.log(extra.id, arteries[extra.id].length);
  await sleep(160);
}

writeFileSync(join(root, "src", "data", "road-paths.json"), `${JSON.stringify({ corridors, arteries }, null, 2)}\n`);
console.log("wrote road-paths.json", Object.keys(corridors).length, "links");
