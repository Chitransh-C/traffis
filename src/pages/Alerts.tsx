import { useMemo, useState } from "react";
import { CAMERA_MAP } from "../data/load";
import { formatStamp } from "../lib/geo";
import type { Alert, AlertLevel } from "../types";

type Filter = "all" | AlertLevel;

type Props = {
  alerts: Alert[];
  onPlate: (plate: string) => void;
};

export function Alerts({ alerts, onPlate }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => {
    const list = [...alerts].sort((a, b) => b.timestamp - a.timestamp);
    return filter === "all" ? list : list.filter((a) => a.level === filter);
  }, [alerts, filter]);
  const counts = useMemo(
    () => ({
      all: alerts.length,
      critical: alerts.filter((a) => a.level === "critical").length,
      warn: alerts.filter((a) => a.level === "warn").length,
      info: alerts.filter((a) => a.level === "info").length,
    }),
    [alerts],
  );

  return (
    <div className="alerts-page">
      <section className="panel">
        <div className="panel-h">
          <span>Alerts · {rows.length}</span>
          <div className="style-switch">
            {(["all", "critical", "warn", "info"] as Filter[]).map((id) => (
              <button key={id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
                {id} · {counts[id]}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-b">
          {!rows.length && <div className="empty">No alerts in this window.</div>}
          <div className="feed">
            {rows.map((a) => (
              <button
                key={a.id}
                className="alert-item"
                onClick={() => a.plate && onPlate(a.plate)}
              >
                <div className="row">
                  <strong>{a.title}</strong>
                  <span className={`tag ${a.level === "critical" ? "crit" : a.level === "warn" ? "warn" : ""}`}>
                    {a.level}
                  </span>
                </div>
                <div className="meta">
                  <span>{a.detail}</span>
                </div>
                <div className="meta">
                  <span>
                    {a.plate ?? "—"}
                    {a.cameraId ? ` · ${a.cameraId} ${CAMERA_MAP[a.cameraId]?.name ?? ""}` : ""}
                  </span>
                  <span>{formatStamp(a.timestamp)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
