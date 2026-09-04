import { CAMERA_MAP } from "./load";
import type { CameraId } from "../types";

type Edge = { a: CameraId; b: CameraId; via: [number, number][] };

const EDGES: Edge[] = [
  { a: "CAM_011", b: "CAM_023", via: [[26.2188, 78.1804]] },
  { a: "CAM_023", b: "CAM_042", via: [[26.2118, 78.1788]] },
  { a: "CAM_011", b: "CAM_103", via: [[26.2232, 78.1736]] },
  { a: "CAM_042", b: "CAM_103", via: [[26.2148, 78.1712]] },
  { a: "CAM_023", b: "CAM_057", via: [[26.2166, 78.188]] },
  { a: "CAM_011", b: "CAM_057", via: [[26.2204, 78.1864]] },
  { a: "CAM_057", b: "CAM_081", via: [[26.2246, 78.2002]] },
];

export function corridorPath(from: CameraId, to: CameraId): [number, number][] | null {
  const edge = EDGES.find(
    (e) => (e.a === from && e.b === to) || (e.a === to && e.b === from),
  );
  if (!edge) return null;
  const start = CAMERA_MAP[from];
  const end = CAMERA_MAP[to];
  const via = edge.a === from ? edge.via : [...edge.via].reverse();
  return [[start.lat, start.lng], ...via, [end.lat, end.lng]];
}

export const ALL_CORRIDORS = EDGES.map((e) => ({
  from: e.a,
  to: e.b,
  path: corridorPath(e.a, e.b)!,
}));
