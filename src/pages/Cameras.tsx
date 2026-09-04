import { CAMERAS, CAMERA_MAP } from "../data/load";
import { cameraActive } from "../lib/playback";
import type { CameraId, Observation } from "../types";

type Props = {
  now: number;
  obs: Observation[];
  focusCamera: CameraId | null;
  onSelectCamera: (id: CameraId) => void;
};

export function Cameras({ now, obs, focusCamera, onSelectCamera }: Props) {
  return (
    <div className="panel">
      <div className="panel-h">Camera network · Gwalior core</div>
      <div className="panel-b">
        <table className="grid-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Site</th>
              <th>Corridor</th>
              <th>Dir</th>
              <th>Lanes</th>
              <th>Hits today</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {CAMERAS.map((c) => {
              const live = cameraActive(now, c.id);
              const hits = obs.filter((o) => o.cameraId === c.id).length;
              const status = !live ? "offline window" : c.status === "degraded" ? "degraded" : "online";
              return (
                <tr
                  key={c.id}
                  className={focusCamera === c.id ? "on" : ""}
                  onClick={() => onSelectCamera(c.id)}
                >
                  <td className="mono">{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.corridor}</td>
                  <td>{c.direction}</td>
                  <td>{c.lanes}</td>
                  <td>{hits}</td>
                  <td>
                    <span className={`tag ${status === "online" ? "ok" : status === "degraded" ? "warn" : "crit"}`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {focusCamera && (
          <p className="meta" style={{ marginTop: 14 }}>
            Focus {CAMERA_MAP[focusCamera]?.name} · {CAMERA_MAP[focusCamera]?.lat.toFixed(4)},{" "}
            {CAMERA_MAP[focusCamera]?.lng.toFixed(4)} — switch to Command to fly the map.
          </p>
        )}
      </div>
    </div>
  );
}
