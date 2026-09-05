import type { ReactNode } from "react";
import { Activity, Bell, Camera, GitBranch, LayoutDashboard, Search } from "lucide-react";
import { CAMERAS, META } from "../data/load";
import { formatClock } from "../lib/geo";
import type { PageId } from "../types";
import { TimeScrubber } from "./TimeScrubber";
import type { Alert } from "../types";
import type { DateMode } from "../lib/clock";
import { formatDateLabel } from "../lib/clock";

const NAV: { id: PageId; label: string; icon: typeof Activity }[] = [
  { id: "command", label: "Command", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: Activity },
  { id: "trajectories", label: "Trajectories", icon: GitBranch },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "alerts", label: "Alerts", icon: Bell },
];

type Props = {
  page: PageId;
  onPage: (p: PageId) => void;
  now: number;
  playing: boolean;
  rate: number;
  onNow: (n: number) => void;
  onPlaying: (p: boolean) => void;
  onRate: (n: number) => void;
  query: string;
  onQuery: (q: string) => void;
  alerts: Alert[];
  onPlate: (plate: string) => void;
  dateMode: DateMode;
  caughtUp: boolean;
  min: number;
  max: number;
  onDateMode: (m: DateMode) => void;
  dayIndex: number;
  onDayIndex: (i: number) => void;
  children: ReactNode;
};

export function Shell({
  page,
  onPage,
  now,
  playing,
  rate,
  onNow,
  onPlaying,
  onRate,
  query,
  onQuery,
  alerts,
  onPlate,
  dateMode,
  caughtUp,
  min,
  max,
  onDateMode,
  dayIndex,
  onDayIndex,
  children,
}: Props) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">T</div>
          <div>
            <h1>Vaahan Drishti</h1>
            <p>
              BEL · {META.city} ANPR / GIS · {formatDateLabel(now)}
            </p>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.id} className={`nav-btn${page === n.id ? " on" : ""}`} onClick={() => onPage(n.id)}>
                <Icon size={14} />
                {n.id === "alerts" ? `Alerts (${alerts.length})` : n.label}
              </button>
            );
          })}
        </nav>
        <div className="live">
          <span className="pulse" />
          NETWORK LIVE · {CAMERAS.length} NODES
        </div>
        <div className="clock">{formatClock(now)}</div>
        <div className="chip search-box">
          <Search size={14} />
          <input
            placeholder="Search plate / vehicle"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      </header>
      <div className="page-slot">{children}</div>
      <TimeScrubber
        now={now}
        playing={playing}
        rate={rate}
        dateMode={dateMode}
        caughtUp={caughtUp}
        min={min}
        max={max}
        onNow={onNow}
        onPlaying={onPlaying}
        onRate={onRate}
        onDateMode={onDateMode}
        dayIndex={dayIndex}
        onDayIndex={onDayIndex}
      />
    </div>
  );
}
