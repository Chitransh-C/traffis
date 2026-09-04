import { useState } from "react";
import { Radio } from "lucide-react";
import { MapView } from "../components/MapView";
import { KpiStrip } from "../components/KpiStrip";
import { VehicleDrawer } from "../components/VehicleDrawer";
import { CAMERAS, CAMERA_MAP, META, VEHICLES, VEHICLE_MAP } from "../data/load";
import { formatHour } from "../lib/geo";
import { avgSpeedUntil, peakHourLabel, recentFeed } from "../lib/analytics";
import { MAP_STYLES, type MapStyleId } from "../lib/mapStyles";
import { TRAJECTORIES, trafficZonesUntil } from "../lib/playback";
import type { CameraId, LiveVehicle, Observation, Alert, CorridorLoad } from "../types";

type Props = {
  now: number;
  obs: Observation[];
  live: LiveVehicle[];
  alerts: Alert[];
  corridors: CorridorLoad[];
  selectedId: string | null;
  focusCamera: CameraId | null;
  onSelectVehicle: (id: string) => void;
  onSelectCamera: (id: CameraId) => void;
};

export function CommandCenter({
  now,
  obs,
  live,
  alerts,
  corridors,
  selectedId,
  focusCamera,
  onSelectVehicle,
  onSelectCamera,
}: Props) {
  const plates = new Set(obs.map((o) => o.canonicalPlate)).size;
  const speed = avgSpeedUntil(now);
  const peak = peakHourLabel(obs, now);
  const feed = recentFeed(obs, 10);
  const selectedTraj = selectedId ? TRAJECTORIES.find((t) => t.vehicleId === selectedId) ?? null : null;
  const selectedVeh = selectedId ? VEHICLE_MAP[selectedId] : null;
  const [mapStyle, setMapStyle] = useState<MapStyleId>("streets");
  const zones = trafficZonesUntil(now);

  return (
    <div className="workspace">
      <aside className="panel">
        <div className="panel-h">Operations</div>
        <div className="panel-b">
          <KpiStrip
            items={[
              { label: "Unique plates", value: plates, hint: `of ${VEHICLES.length} in fleet` },
              { label: "Avg speed", value: speed.toFixed(1), hint: "km/h city mean" },
              { label: "Cameras", value: CAMERAS.length, hint: "ANPR nodes" },
              {
                label: "Alerts",
                value: alerts.length,
                hint: `peak ${peak}`,
                danger: alerts.some((a) => a.level === "critical"),
              },
            ]}
          />
          <div className="panel-h sub">Latest observations</div>
          <div className="feed">
            {feed.map((o) => (
              <button
                key={o.id}
                className={`feed-item${selectedId === o.vehicleId ? " on" : ""}`}
                onClick={() => onSelectVehicle(o.vehicleId)}
              >
                <div className="row">
                  <strong>{o.plate}</strong>
                  <span className="tag">{o.vehicleType}</span>
                </div>
                <div className="meta">
                  <span>
                    {o.cameraId} · {CAMERA_MAP[o.cameraId]?.name}
                  </span>
                  <span>
                    {formatHour(o.timestamp)} · {(o.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            ))}
            {!feed.length && <div className="empty">Rewind the day to see the first detections.</div>}
          </div>
        </div>
      </aside>

      <section className="panel map-wrap">
        <MapView
          now={now}
          live={[]}
          corridors={corridors}
          zones={zones}
          selectedId={selectedId}
          selectedTraj={selectedTraj}
          focusCamera={focusCamera}
          mapStyle={mapStyle}
          onSelectVehicle={onSelectVehicle}
          onSelectCamera={onSelectCamera}
        />
        <div className="hud">
          <div className="chip">
            <Radio size={12} /> {(META.sector ?? META.city).toUpperCase()}
          </div>
          <div className="style-switch">
            {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => (
              <button key={id} className={mapStyle === id ? "on" : ""} onClick={() => setMapStyle(id)}>
                {MAP_STYLES[id].label}
              </button>
            ))}
          </div>
          <div className="chip">{obs.length} events</div>
          <div className="chip">{CAMERAS.length} cameras</div>
        </div>
        <div className="legend">
          <div>
            <i style={{ background: "#e11d48" }} />
            Heavy zone
          </div>
          <div>
            <i style={{ background: "#d97706" }} />
            Moderate
          </div>
          <div>
            <i style={{ background: "#059669" }} />
            Free flow
          </div>
          <div>
            <i style={{ background: "#1d4ed8" }} />
            Camera
          </div>
        </div>
      </section>

      <aside className="panel">
        <div className="panel-h">
          <span>Target</span>
        </div>
        <div className="panel-b">
          <VehicleDrawer vehicle={selectedVeh ?? null} traj={selectedTraj} now={now} />
        </div>
      </aside>
    </div>
  );
}
