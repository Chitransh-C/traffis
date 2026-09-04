export type VehicleType = "car" | "bike" | "bus" | "truck" | "auto";
export type CameraId = string;
export type AlertLevel = "critical" | "warn" | "info";
export type PageId = "command" | "analytics" | "trajectories" | "cameras" | "alerts";

export type Camera = {
  id: CameraId;
  name: string;
  corridor: string;
  lat: number;
  lng: number;
  direction: string;
  lanes: number;
  status: "online" | "degraded";
};

export type Vehicle = {
  id: string;
  plate: string;
  type: VehicleType;
  color: string;
  watchlist: boolean;
  ownerHint: string;
};

export type Observation = {
  id: string;
  vehicleId: string;
  plate: string;
  canonicalPlate: string;
  confidence: number;
  cameraId: CameraId;
  timestamp: number;
  lat: number;
  lng: number;
  direction: string;
  vehicleType: VehicleType;
};

export type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  timestamp: number;
  plate?: string;
  cameraId?: CameraId;
};

export type MetaDay = {
  iso: string;
  start: number;
  end: number;
  label: string;
  weekday: number;
};

export type Meta = {
  city: string;
  state: string;
  sector?: string;
  center: [number, number];
  zoom: number;
  weekStart?: number;
  weekEnd?: number;
  dayStart: number;
  dayEnd: number;
  dateLabel: string;
  days?: MetaDay[];
};

export type Hop = {
  from: CameraId;
  to: CameraId;
  start: number;
  end: number;
  km: number;
  expectedMin: number;
  observedMin: number;
  probability: number;
  path: [number, number][];
};

export type Trajectory = {
  vehicleId: string;
  plate: string;
  hops: Hop[];
  observations: Observation[];
};

export type LiveVehicle = {
  vehicleId: string;
  plate: string;
  type: VehicleType;
  watchlist: boolean;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  from: CameraId;
  to: CameraId;
  progress: number;
  lastConfidence: number;
};

export type CongestionLevel = "heavy" | "moderate" | "free";

export type CorridorLoad = {
  key: string;
  from: CameraId;
  to: CameraId;
  path: [number, number][];
  count: number;
  avgSpeed: number;
  level: CongestionLevel;
  label: string;
};

export type RouteBand = "likely" | "possible" | "unlikely" | "blocked";
export type RouteKind = "direct" | "miss" | "alternate";

export type RouteHypothesis = {
  id: string;
  hopIndex: number;
  cameras: CameraId[];
  path: [number, number][];
  km: number;
  estMin: number;
  observedMin: number;
  p: number;
  color: string;
  band: RouteBand;
  kind: RouteKind;
  reasons: string[];
  skipped: CameraId[];
  blocked: boolean;
  fromTs: number;
  toTs: number;
};

export type LastSeenReach = {
  id: CameraId;
  name: string;
  km: number;
  estMin: number;
};

export type LastSeenZone = {
  cameraId: CameraId;
  name: string;
  lat: number;
  lng: number;
  lastTs: number;
  asOf: number;
  elapsedMin: number;
  likelyRadiusM: number;
  possibleRadiusM: number;
  reachable: LastSeenReach[];
};

export type TrafficZone = {
  id: string;
  cameraId: CameraId;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  count: number;
  level: CongestionLevel;
};
