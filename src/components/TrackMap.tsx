import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { CAMERA_MAP, META } from "../data/load";
import { circleRing, formatHour } from "../lib/geo";
import { mapStyleUrl } from "../lib/mapStyles";
import { estTimeAtCamera, nearestTimeOnPath, topHypothesis, hyposByHop } from "../lib/routeEngine";
import type { LastSeenZone, Observation, RouteHypothesis } from "../types";

type Props = {
  hits: Observation[];
  hypotheses: RouteHypothesis[];
  fallbackPath: [number, number][];
  plotKey: number;
  showAllPaths: boolean;
  showZone: boolean;
  zone: LastSeenZone | null;
  focusHop: number;
  selectedHypoId: string | null;
  onFocusHop: (hop: number) => void;
};

export function TrackMap({
  hits,
  hypotheses,
  fallbackPath,
  plotKey,
  showAllPaths,
  showZone,
  zone,
  focusHop,
  selectedHypoId,
  onFocusHop,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const hitMarkers = useRef<maplibregl.Marker[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);
  const hoverId = useRef<string | null>(null);
  const dataRef = useRef({
    hits,
    hypotheses,
    fallbackPath,
    showAllPaths,
    showZone,
    zone,
    focusHop,
    selectedHypoId,
    onFocusHop,
  });
  dataRef.current = {
    hits,
    hypotheses,
    fallbackPath,
    showAllPaths,
    showZone,
    zone,
    focusHop,
    selectedHypoId,
    onFocusHop,
  };

  useEffect(() => {
    if (!root.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: root.current,
      style: mapStyleUrl("streets"),
      center: [META.center[1], META.center[0]],
      zoom: 13.1,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    popup.current = new maplibregl.Popup({ closeButton: false, offset: 12, maxWidth: "280px" });

    const onLoad = () => {
      ensureLayers(map);
      ready.current = true;
      paint(map, hitMarkers, dataRef.current, hoverId.current);
    };
    map.on("load", onLoad);
    map.on("style.load", onLoad);

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ["hypo-hit"] });
      const f = feats[0];
      const pop = popup.current;
      const id = f ? String(f.properties?.id ?? "") : null;
      if (hoverId.current !== id) {
        hoverId.current = id;
        paintLines(map, dataRef.current, id);
      }
      if (!f || !pop || !id) {
        pop?.remove();
        map.getCanvas().style.cursor = "";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const h = dataRef.current.hypotheses.find((x) => x.id === id);
      if (!h) return;
      const ll = e.lngLat;
      const ts = nearestTimeOnPath(h, ll.lat, ll.lng);
      const names = h.cameras.map((c) => CAMERA_MAP[c]?.name ?? c).join(" → ");
      const skip = h.skipped.map((c) => CAMERA_MAP[c]?.name ?? c).join(", ");
      const obsKmh = h.observedMin > 0 ? (h.km / h.observedMin) * 60 : 0;
      const expKmh = h.estMin > 0 ? (h.km / h.estMin) * 60 : 24;
      const lo = Math.max(8, expKmh * 0.7);
      const hi = expKmh * 1.35;
      pop
        .setLngLat(ll)
        .setHTML(
          `<div class="map-pop">
            <b>${h.kind === "miss" ? "Missed capture" : h.kind === "alternate" ? "Alternate route" : "Direct hop"} · ${(h.p * 100).toFixed(0)}%</b>
            <span>${names}</span>
            <span>Speed range ${lo.toFixed(0)}–${hi.toFixed(0)} km/h · observed ${obsKmh.toFixed(0)} km/h</span>
            <span>Est. here ${formatHour(ts)} · ${h.km} km · ${h.estMin} min expected</span>
            <span>Observed ${formatHour(h.fromTs)} → ${formatHour(h.toTs)} (${h.observedMin} min)</span>
            ${skip ? `<span>Silent: ${skip}</span>` : ""}
            <span>${h.reasons[0] ?? ""}</span>
          </div>`,
        )
        .addTo(map);
    };
    map.on("mousemove", onMove);
    map.on("mouseleave", () => {
      hoverId.current = null;
      popup.current?.remove();
      paintLines(map, dataRef.current, null);
    });

    return () => {
      map.off("mousemove", onMove);
      popup.current?.remove();
      hitMarkers.current.forEach((m) => m.remove());
      hitMarkers.current = [];
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    paint(map, hitMarkers, dataRef.current, hoverId.current);
    fit(map, hits, hypotheses, fallbackPath, showZone ? zone : null);
  }, [hits, hypotheses, fallbackPath, plotKey, showAllPaths, showZone, zone, focusHop, selectedHypoId]);

  return <div ref={root} className="map" />;
}

function ensureLayers(map: maplibregl.Map) {
  if (!map.hasImage("track-arrow")) {
    map.addImage("track-arrow", makeArrowImage(), { pixelRatio: 2 });
  }
  if (!map.getSource("zone")) {
    map.addSource("zone", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "zone-fill",
      type: "fill",
      source: "zone",
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": ["get", "fillOp"],
      },
    });
    map.addLayer({
      id: "zone-ring",
      type: "line",
      source: "zone",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.6,
        "line-opacity": 0.7,
        "line-dasharray": [2, 1.4],
      },
    });
  }
  if (!map.getSource("hypos")) {
    map.addSource("hypos", { type: "geojson", data: emptyFc() });
    map.addSource("arrows", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "hypo-glow",
      type: "line",
      source: "hypos",
      filter: ["any", ["==", ["get", "role"], "selected"], ["==", ["get", "role"], "focus"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 11, "line-opacity": 0.22 },
    });
    map.addLayer({
      id: "hypo-faint",
      type: "line",
      source: "hypos",
      filter: ["==", ["get", "role"], "faint"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
        "line-opacity": 0.38,
        "line-dasharray": [2, 1.6],
      },
    });
    map.addLayer({
      id: "hypo-line",
      type: "line",
      source: "hypos",
      filter: ["!=", ["get", "role"], "faint"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["match", ["get", "role"], "selected", 6, "focus", 5, "hover", 6.5, 3],
        "line-opacity": ["match", ["get", "role"], "chain", 0.42, "hover", 1, 0.92],
      },
    });
    map.addLayer({
      id: "hypo-hit",
      type: "line",
      source: "hypos",
      paint: { "line-color": "#000000", "line-width": 16, "line-opacity": 0.01 },
    });
    map.addLayer({
      id: "track-arrows",
      type: "symbol",
      source: "arrows",
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 56,
        "icon-image": "track-arrow",
        "icon-size": 0.85,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
      },
    });
  }
}

type PaintData = {
  hits: Observation[];
  hypotheses: RouteHypothesis[];
  fallbackPath: [number, number][];
  showAllPaths: boolean;
  showZone: boolean;
  zone: LastSeenZone | null;
  focusHop: number;
  selectedHypoId: string | null;
  onFocusHop: (hop: number) => void;
};

function roleOf(h: RouteHypothesis, data: PaintData, hover: string | null) {
  if (hover === h.id || data.selectedHypoId === h.id) return hover === h.id && data.selectedHypoId !== h.id ? "hover" : "selected";
  if (data.showAllPaths && h.hopIndex === data.focusHop) {
    if (h.band === "unlikely" || h.band === "blocked") return "faint";
    return "focus";
  }
  return "chain";
}

function lineFeatures(data: PaintData, hover: string | null) {
  const lines = data.hypotheses.filter((h) => h.path.length > 1);
  if (!lines.length && data.fallbackPath.length > 1) {
    return [
      {
        type: "Feature" as const,
        properties: { id: "fallback", color: "#0369a1", band: "likely", role: "selected" },
        geometry: { type: "LineString" as const, coordinates: data.fallbackPath.map(([lat, lng]) => [lng, lat]) },
      },
    ];
  }
  return lines.map((h) => ({
    type: "Feature" as const,
    properties: {
      id: h.id,
      color: h.color,
      band: h.band,
      role: roleOf(h, data, hover),
    },
    geometry: { type: "LineString" as const, coordinates: h.path.map(([lat, lng]) => [lng, lat]) },
  }));
}

function paintZone(map: maplibregl.Map, data: PaintData) {
  const src = map.getSource("zone") as maplibregl.GeoJSONSource | undefined;
  const z = data.showZone ? data.zone : null;
  if (!src) return;
  if (!z) {
    src.setData(emptyFc());
    return;
  }
  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { color: "#d97706", fillOp: 0.08 },
        geometry: { type: "Polygon", coordinates: [circleRing(z.lat, z.lng, z.possibleRadiusM)] },
      },
      {
        type: "Feature",
        properties: { color: "#0891b2", fillOp: 0.14 },
        geometry: { type: "Polygon", coordinates: [circleRing(z.lat, z.lng, z.likelyRadiusM)] },
      },
    ],
  });
}

function paintLines(map: maplibregl.Map, data: PaintData, hover: string | null) {
  const features = lineFeatures(data, hover);
  const fc = { type: "FeatureCollection" as const, features };
  (map.getSource("hypos") as maplibregl.GeoJSONSource | undefined)?.setData(fc);
  const arrowIds = new Set(
    features.filter((f) => f.properties.role === "selected" || f.properties.role === "focus").map((f) => f.properties.id),
  );
  (map.getSource("arrows") as maplibregl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: features.filter((f) => arrowIds.has(f.properties.id)),
  });
}

function paint(
  map: maplibregl.Map,
  markers: { current: maplibregl.Marker[] },
  data: PaintData,
  hover: string | null,
) {
  paintZone(map, data);
  paintLines(map, data, hover);
  markers.current.forEach((m) => m.remove());
  markers.current = [];

  data.hits.forEach((hit, i) => {
    const cam = CAMERA_MAP[hit.cameraId];
    const next = data.hits[i + 1];
    const nextName = next ? (CAMERA_MAP[next.cameraId]?.name ?? next.cameraId) : null;
    const hop = i < data.hits.length - 1 ? i : Math.max(0, i - 1);
    const kind = i === 0 ? "start" : i === data.hits.length - 1 ? "end" : "";
    const focused = data.showAllPaths && (i === data.focusHop || i === data.focusHop + 1);
    markers.current.push(
      markerEl(
        [cam?.lng ?? hit.lng, cam?.lat ?? hit.lat],
        i + 1,
        cam?.name ?? hit.cameraId,
        formatHour(hit.timestamp),
        nextName ? `→ ${nextName}` : "end",
        `${kind}${focused ? " focus" : ""}`,
        map,
        () => data.onFocusHop(hop),
      ),
    );
  });

  if (!data.showAllPaths) return;
  const grouped = hyposByHop(data.hypotheses);
  const list = grouped.get(data.focusHop) ?? [];
  const top = data.selectedHypoId
    ? (list.find((h) => h.id === data.selectedHypoId) ?? topHypothesis(list))
    : topHypothesis(list);
  if (!top) return;
  const seen = new Set(data.hits.map((h) => h.cameraId));
  for (const id of top.skipped) {
    if (seen.has(id)) continue;
    seen.add(id);
    const cam = CAMERA_MAP[id];
    if (!cam) continue;
    markers.current.push(
      markerEl(
        [cam.lng, cam.lat],
        "·",
        cam.name,
        `est ${formatHour(estTimeAtCamera(top, id))}`,
        "no hit · possible miss",
        "skip",
        map,
      ),
    );
  }
}

function markerEl(
  lngLat: [number, number],
  n: number | string,
  title: string,
  time: string,
  sub: string,
  kind: string,
  map: maplibregl.Map,
  onClick?: () => void,
) {
  const el = document.createElement("div");
  el.style.cursor = onClick ? "pointer" : "default";
  el.innerHTML = `
    <div class="hit-mark">
      <div class="hit-pin ${kind}"><span>${n}</span></div>
      <div class="hit-label">
        <b>${escapeHtml(title)}</b>
        <em>${escapeHtml(time)}</em>
        <span>${escapeHtml(sub)}</span>
      </div>
    </div>
  `;
  if (onClick) el.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(lngLat).addTo(map);
}

function fit(
  map: maplibregl.Map,
  hits: Observation[],
  hypotheses: RouteHypothesis[],
  fallback: [number, number][],
  zone: LastSeenZone | null,
) {
  const pts: [number, number][] = [];
  for (const h of hypotheses) for (const [lat, lng] of h.path) pts.push([lng, lat]);
  if (!pts.length) for (const [lat, lng] of fallback) pts.push([lng, lat]);
  if (zone) {
    const ring = circleRing(zone.lat, zone.lng, zone.possibleRadiusM);
    for (const [lng, lat] of ring) pts.push([lng, lat]);
  }
  if (!pts.length) {
    for (const hit of hits) {
      const c = CAMERA_MAP[hit.cameraId];
      pts.push([c?.lng ?? hit.lng, c?.lat ?? hit.lat]);
    }
  }
  if (pts.length < 1) {
    map.easeTo({ center: [META.center[1], META.center[0]], zoom: 13.1, duration: 400 });
    return;
  }
  if (pts.length === 1) {
    map.easeTo({ center: pts[0], zoom: 15.2, duration: 600 });
    return;
  }
  const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  pts.forEach((p) => b.extend(p));
  map.fitBounds(b, { padding: { top: 72, bottom: 48, left: 48, right: 48 }, duration: 700, maxZoom: 15.2 });
}

function makeArrowImage(): ImageData {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, -7);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
