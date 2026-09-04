import { formatHour } from "../lib/geo";
import { formatDateLabel, metaDays, type DateMode } from "../lib/clock";

const SPEEDS = [10, 30, 60];

type Props = {
  now: number;
  playing: boolean;
  rate: number;
  dateMode: DateMode;
  dayIndex: number;
  caughtUp: boolean;
  min: number;
  max: number;
  onNow: (n: number) => void;
  onPlaying: (p: boolean) => void;
  onRate: (n: number) => void;
  onDateMode: (m: DateMode) => void;
  onDayIndex: (i: number) => void;
};

export function TimeScrubber({
  now,
  playing,
  rate,
  dateMode,
  dayIndex,
  caughtUp,
  min,
  max,
  onNow,
  onPlaying,
  onRate,
  onDateMode,
  onDayIndex,
}: Props) {
  const liveRate = caughtUp ? 1 : rate;
  const days = metaDays();
  return (
    <div className="scrubber">
      <div className="date-col">
        <div className="date-switch">
          <button className={dateMode === "archive" ? "on" : ""} onClick={() => onDateMode("archive")}>
            Select date
          </button>
          <button className={dateMode === "live" ? "on" : ""} onClick={() => onDateMode("live")}>
            Current date
          </button>
        </div>
        {dateMode === "archive" && (
          <select
            className="day-select"
            value={dayIndex}
            onChange={(e) => onDayIndex(Number(e.target.value))}
          >
            {days.map((d, i) => (
              <option key={d.iso} value={i}>
                {d.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <button className="ctrl" onClick={() => onPlaying(!playing)}>
        {playing ? "PAUSE" : "PLAY"}
      </button>
      <input
        type="range"
        min={min}
        max={max}
        value={Math.min(now, max)}
        onChange={(e) => onNow(Number(e.target.value))}
      />
      <span className="mono dim">
        {formatDateLabel(now)} · {formatHour(now)}
      </span>
      <div className="speed-btns">
        {caughtUp && <span className="live-lock">LIVE 1×</span>}
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`ctrl${liveRate === s && !caughtUp ? " on" : ""}`}
            disabled={caughtUp}
            onClick={() => onRate(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
