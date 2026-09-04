export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function rad(d: number) {
  return (d * Math.PI) / 180;
}

export function interpolateSegment(a: [number, number], b: [number, number], t: number): [number, number] {
  const u = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

export function interpolatePath(path: [number, number][], t: number): [number, number] {
  if (path.length < 2) return path[0] ?? [0, 0];
  const u = Math.min(1, Math.max(0, t));
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1], path[i]) || 0.0004;
    lens.push(d);
    total += d;
  }
  let remain = u * total;
  for (let i = 0; i < lens.length; i++) {
    if (remain <= lens[i]) {
      return interpolateSegment(path[i], path[i + 1], remain / lens[i]);
    }
    remain -= lens[i];
  }
  return path[path.length - 1];
}

export function circleRing(lat: number, lng: number, radiusM: number, steps = 48): [number, number][] {
  const latM = 1 / 111_320;
  const lngM = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lng + radiusM * lngM * Math.cos(a), lat + radiusM * latM * Math.sin(a)]);
  }
  return ring;
}

export function headingDeg(a: [number, number], b: [number, number]) {
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
}

export function pathLengthKm(path: [number, number][]) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1], path[i]);
  return km;
}

export function dayLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export function formatHour(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export function formatStamp(ts: number) {
  return new Date(ts).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
