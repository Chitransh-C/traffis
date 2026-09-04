import { formatHour } from "../lib/geo";
import type { Alert } from "../types";

export function AlertTicker({ alerts, onPlate }: { alerts: Alert[]; onPlate: (plate: string) => void }) {
  const latest = [...alerts].reverse().slice(0, 8);
  if (!latest.length) {
    return <div className="ticker">Alert net clear · no incidents at this timestamp</div>;
  }
  return (
    <div className="ticker">
      <span className="ticker-lab">ALERTS</span>
      <div className="ticker-track">
        {latest.map((a) => (
          <button key={a.id} className={`ticker-item ${a.level}`} onClick={() => a.plate && onPlate(a.plate)}>
            {formatHour(a.timestamp)} · {a.title}
          </button>
        ))}
      </div>
    </div>
  );
}
