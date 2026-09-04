import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { CAMERAS, CAMERA_MAP, META } from "../data/load";
import { cameraActive } from "../lib/playback";
import { circleRing } from "../lib/geo";
import { mapStyleUrl, type MapStyleId } from "../lib/mapStyles";
import type { CameraId, CongestionLevel, CorridorLoad, LiveVehicle, TrafficZone, Trajectory } from "../types";

const BEARING: Record<string, number> = {
  NORTH: 0,
  EAST: 90,
  SOUTH: 180,
  WEST: 270,
};

const LEVEL_COLOR: Record<CongestionLevel, string> = {
  heavy: "#e11d48",
  moderate: "#d97706",
  free: "#059669",
};

type Props = {
  now: number;
  live: LiveVehicle[];
  corridors: CorridorLoad[];
  zones: TrafficZone[];
  selectedId: string | null;
  selectedTraj: Trajectory | null;
  focusCamera: CameraId | null;
  mapStyle: MapStyleId;
  onSelectVehicle: (id: string) => void;
  onSelectCamera: (id: CameraId) => void;
};

export function MapView({
  now,
  live,
  corridors,
  zones,
  selectedId,
  selectedTraj,
  focusCamera,
  mapStyle,
  onSelectVehicle,
  onSelectCamera,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const camMarkers = useRef<maplibregl.Marker[]>([]);
  const vehMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const ready = useRef(false);
  const cbs = useRef({ onSelectVehicle, onSelectCamera });
  const dataRef = useRef({ corridors, zones });
  cbs.current = { onSelectVehicle, onSelectCamera };
  dataRef.current = { corridors, zones };

  useEffect(() => {
    if (!root.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: root.current,
      style: mapStyleUrl(mapStyle),
      center: [META.center[1], META.center[0]],
      zoom: 13.05,
      pitch: 42,
      bearing: -18,
      attributionControl: { compact: true },
      maxPitch: 60,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
    mapRef.current = map;

    const onStyle = () => {
      addOverlays(map);
      paintOverlays(map, dataRef.current.corridors, dataRef.current.zones);
      if (!camMarkers.current.length) {
        camMarkers.current = CAMERAS.map((cam) => makeCameraMarker(cam, map, (id) => cbs.current.onSelectCamera(id)));
      }
      ready.current = true;
    };
    map.on("load", onStyle);
    map.on("style.load", onStyle);

    return () => {
      camMarkers.current.forEach((m) => m.remove());
      vehMarkers.current.forEach((m) => m.remove());
      camMarkers.current = [];
      vehMarkers.current.clear();
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
    // Map instance is created once; style changes use setStyle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ready.current = false;
    map.setStyle(mapStyleUrl(mapStyle));
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    paintOverlays(map, corridors, zones);
  }, [corridors, zones]);

  useEffect(() => {
    camMarkers.current.forEach((marker, i) => {
      const cam = CAMERAS[i];
      const node = marker.getElement().querySelector(".cam-pin");
      const online = cameraActive(now, cam.id);
      node?.classList.toggle("hot", !online || cam.status === "degraded");
      node?.classList.toggle("off", !online);
    });
  }, [now]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const seen = new Set<string>();
    for (const v of live) {
      seen.add(v.vehicleId);
      let marker = vehMarkers.current.get(v.vehicleId);
      if (!marker) {
        const el = document.createElement("div");
        const inner = document.createElement("div");
        inner.className = `rider${v.watchlist ? " watch" : ""}`;
        inner.innerHTML = `<span class="rider-halo"></span><span class="rider-dot"></span><span class="rider-plate">${v.plate}</span>`;
        el.appendChild(inner);
        el.title = v.plate;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          cbs.current.onSelectVehicle(v.vehicleId);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(map);
        vehMarkers.current.set(v.vehicleId, marker);
      }
      marker.setLngLat([v.lng, v.lat]);
      const inner = marker.getElement().querySelector(".rider");
      inner?.classList.toggle("watch", v.watchlist);
      inner?.classList.toggle("sel", selectedId === v.vehicleId);
    }
    for (const [id, marker] of vehMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        vehMarkers.current.delete(id);
      }
    }
  }, [live, selectedId]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (focusCamera) {
      const cam = CAMERA_MAP[focusCamera];
      if (cam) mapRef.current.easeTo({ center: [cam.lng, cam.lat], zoom: 15.2, pitch: 48, duration: 800 });
      return;
    }
    if (!selectedId) return;
    const liveHit = live.find((v) => v.vehicleId === selectedId);
    if (liveHit) {
      mapRef.current.easeTo({ center: [liveHit.lng, liveHit.lat], zoom: 14.4, duration: 650 });
      return;
    }
    const last = selectedTraj?.observations.at(-1);
    if (last) mapRef.current.easeTo({ center: [last.lng, last.lat], zoom: 14.2, duration: 650 });
  }, [selectedId, focusCamera]);

  return <div ref={root} className="map" />;
}

function addOverlays(map: maplibregl.Map) {
  if (!map.getSource("zones")) {
    map.addSource("zones", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "zones-fill",
      type: "fill",
      source: "zones",
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.18,
      },
    });
    map.addLayer({
      id: "zones-ring",
      type: "line",
      source: "zones",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.4,
        "line-opacity": 0.55,
        "line-dasharray": [2, 1.4],
      },
    });
  }
  if (!map.getSource("corridors")) {
    map.addSource("corridors", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "corridors-glow",
      type: "line",
      source: "corridors",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 15, 16],
        "line-opacity": 0.2,
        "line-blur": 1.2,
      },
    });
    map.addLayer({
      id: "corridors",
      type: "line",
      source: "corridors",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3.5, 15, 7],
        "line-opacity": 0.88,
      },
    });
    map.addLayer({
      id: "corridor-labels",
      type: "symbol",
      source: "corridors",
      layout: {
        "symbol-placement": "line-center",
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-max-angle": 25,
        "text-padding": 2,
      },
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
    });
  }
  if (!map.getSource("zone-labels")) {
    map.addSource("zone-labels", { type: "geojson", data: emptyFc() });
    map.addLayer({
      id: "zone-labels",
      type: "symbol",
      source: "zone-labels",
      layout: {
        "text-field": ["concat", ["get", "name"], " · ", ["get", "status"]],
        "text-size": 11,
        "text-offset": [0, 1.6],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
    });
  }
}

function paintOverlays(map: maplibregl.Map, corridors: CorridorLoad[], zones: TrafficZone[]) {
  const zoneSrc = map.getSource("zones") as maplibregl.GeoJSONSource | undefined;
  zoneSrc?.setData({
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      properties: { color: LEVEL_COLOR[z.level], name: z.name, count: z.count },
      geometry: { type: "Polygon", coordinates: [circleRing(z.lat, z.lng, z.radiusM)] },
    })),
  });
  const corridorsSrc = map.getSource("corridors") as maplibregl.GeoJSONSource | undefined;
  corridorsSrc?.setData({
    type: "FeatureCollection",
    features: corridors.map((c) => ({
      type: "Feature",
      properties: { color: LEVEL_COLOR[c.level], label: c.label, width: 4 + Math.min(6, c.count) },
      geometry: { type: "LineString", coordinates: c.path.map(([lat, lng]) => [lng, lat]) },
    })),
  });
  const labelSrc = map.getSource("zone-labels") as maplibregl.GeoJSONSource | undefined;
  labelSrc?.setData({
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      properties: {
        name: z.name,
        status: z.level === "heavy" ? "Heavy" : z.level === "moderate" ? "Moderate" : "Free",
      },
      geometry: { type: "Point", coordinates: [z.lng, z.lat] },
    })),
  });
}

function makeCameraMarker(
  cam: (typeof CAMERAS)[number],
  map: maplibregl.Map,
  onSelect: (id: CameraId) => void,
) {
  const num = cam.id.slice(-2);
  const rot = BEARING[cam.direction] ?? 0;
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="cam-wrap">
      <div class="cam-cone" style="transform: rotate(${rot}deg)"></div>
      <div class="cam-pin">
        <div class="cam-pin-head"><span>${num}</span></div>
      </div>
      <div class="cam-caption">${cam.name}</div>
    </div>
  `;
  el.style.cursor = "pointer";
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(cam.id);
  });
  return new maplibregl.Marker({ element: el, anchor: "bottom" })
    .setLngLat([cam.lng, cam.lat])
    .setPopup(
      new maplibregl.Popup({ offset: 28, closeButton: false }).setHTML(
        `<div class="map-pop"><b>${cam.name}</b><span>${cam.id} · ${cam.corridor}</span><span>${cam.lanes} lanes · facing ${cam.direction}</span></div>`,
      ),
    )
    .addTo(map);
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
