import { ShieldAlert } from "lucide-react";
import { opsDayStart } from "../lib/clock";
import { formatHour } from "../lib/geo";
import type { Trajectory, Vehicle } from "../types";

type Props = {
  vehicle: Vehicle | null;
  traj: Trajectory | null;
  now: number;
};

export function VehicleDrawer({ vehicle, traj, now }: Props) {
  if (!vehicle || !traj) {
    return <div className="empty">Select a plate from the feed, map, or search.</div>;
  }
  const day0 = opsDayStart(now);
  const hops = traj.hops.filter((h) => h.start >= day0 && h.start <= now);
  const hits = traj.observations.filter((o) => o.timestamp >= day0 && o.timestamp <= now);
  return (
    <div>
      <div className="drawer-head">
        <strong className="mono lg">{vehicle.plate}</strong>
        {vehicle.watchlist && (
          <span className="tag crit">
            <ShieldAlert size={10} /> watchlist
          </span>
        )}
      </div>
      <div className="meta">
        <span>
          {vehicle.color} {vehicle.type} · {vehicle.ownerHint}
        </span>
      </div>
      <div className="meta">
        <span>{hops.length} reconstructed hops</span>
        <span>{hits.length} camera hits</span>
      </div>
      <div className="timeline">
        {hops.map((h) => (
          <div className="hop" key={`${h.from}-${h.start}`}>
            <div className="rail" />
            <div>
              <b>
                {h.from} → {h.to}
              </b>
              <div className="meta">
                <span>
                  {formatHour(h.start)}–{formatHour(h.end)} · {h.km} km
                </span>
                <span className="tag ok">p={h.probability}</span>
              </div>
              <div className="meta">
                <span>
                  {h.observedMin} min vs exp {h.expectedMin}
                </span>
              </div>
            </div>
          </div>
        ))}
        {!hops.length && <div className="empty">No hops yet at this timestamp.</div>}
      </div>
    </div>
  );
}
