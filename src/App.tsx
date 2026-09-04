import { useEffect, useMemo, useState } from "react";
import { Shell } from "./components/Shell";
import { loadFromApi, VEHICLE_BY_PLATE, VEHICLES } from "./data/load";
import { metaDays, toArchiveNow, windowFor, type DateMode } from "./lib/clock";
import {
  alertsUntil,
  corridorLoadUntil,
  liveVehiclesAt,
  observationsUntil,
  rebuildPlayback,
} from "./lib/playback";
import { Alerts } from "./pages/Alerts";
import { Analytics } from "./pages/Analytics";
import { Cameras } from "./pages/Cameras";
import { CommandCenter } from "./pages/CommandCenter";
import { Trajectories } from "./pages/Trajectories";
import type { CameraId, PageId } from "./types";

const TICK_MS = 250;

export function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("command");
  const [dateMode, setDateMode] = useState<DateMode>("archive");
  const [dayIndex, setDayIndex] = useState(0);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(10);
  const [wall, setWall] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusCam, setFocusCam] = useState<CameraId | null>(null);

  useEffect(() => {
    loadFromApi()
      .then(() => {
        rebuildPlayback();
        const idx = Math.max(0, metaDays().length - 1);
        setDayIndex(idx);
        setNow(windowFor("archive", idx).start + 150 * 60_000);
        setSelectedId(VEHICLES[0]?.id ?? null);
        setReady(true);
      })
      .catch((err: Error) => setBootError(err.message));
  }, []);

  const win = windowFor(dateMode, dayIndex);
  const beforeWindow = dateMode === "live" && wall < win.start;
  const cap = dateMode === "live" ? (beforeWindow ? win.start : Math.min(wall, win.end)) : win.end;
  const caughtUp = dateMode === "live" && (beforeWindow || now >= cap - 400);
  const effectiveRate = caughtUp ? 1 : rate;

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => setWall(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ready]);

  useEffect(() => {
    if (!ready || !playing) return;
    const id = window.setInterval(() => {
      setNow((t) => {
        if (dateMode === "live") {
          const liveCap = Math.min(Date.now(), win.end);
          if (t >= liveCap) return liveCap;
          return Math.min(t + effectiveRate * TICK_MS, liveCap);
        }
        const next = t + effectiveRate * TICK_MS;
        return next > win.end ? win.start : next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [ready, playing, effectiveRate, dateMode, win.start, win.end]);

  const archiveNow = toArchiveNow(now, dateMode, dayIndex);
  const obs = useMemo(() => (ready ? observationsUntil(archiveNow) : []), [ready, archiveNow]);
  const live = useMemo(() => (ready ? liveVehiclesAt(archiveNow) : []), [ready, archiveNow]);
  const alerts = useMemo(() => (ready ? alertsUntil(archiveNow) : []), [ready, archiveNow]);
  const corridors = useMemo(() => (ready ? corridorLoadUntil(archiveNow) : []), [ready, archiveNow]);

  if (bootError) {
    return (
      <div className="boot">
        <h1>API offline</h1>
        <p>Could not load Postgres data: {bootError}</p>
        <p className="dim">Start Docker and the API: docker compose up -d · npm run api · npm run db:seed</p>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="boot">
        <h1>TRAFFIS</h1>
        <p>Loading city events from Postgres…</p>
      </div>
    );
  }

  const switchMode = (mode: DateMode) => {
    setDateMode(mode);
    const next = windowFor(mode, dayIndex);
    if (mode === "live") {
      setDayIndex(Math.max(0, next.index));
      setNow(next.start);
      setRate(30);
      setPlaying(true);
    } else {
      setNow(next.start + 150 * 60_000);
      setRate(10);
    }
  };

  const switchDay = (i: number) => {
    setDayIndex(i);
    const next = windowFor("archive", i);
    setNow(next.start + 150 * 60_000);
    setDateMode("archive");
  };

  const selectPlate = (plate: string) => {
    const v = VEHICLE_BY_PLATE[plate];
    if (v) {
      setSelectedId(v.id);
      setQuery(v.plate);
      setPage("trajectories");
    }
  };

  return (
    <Shell
      page={page}
      onPage={setPage}
      now={now}
      playing={playing}
      rate={rate}
      onNow={(t) => setNow(Math.min(t, cap))}
      onPlaying={setPlaying}
      onRate={(s) => {
        if (!caughtUp) setRate(s);
      }}
      query={query}
      onQuery={(q) => {
        setQuery(q);
        if (q.trim()) setPage("trajectories");
      }}
      alerts={alerts}
      onPlate={selectPlate}
      dateMode={dateMode}
      caughtUp={caughtUp}
      min={win.start}
      max={cap}
      onDateMode={switchMode}
      dayIndex={dayIndex}
      onDayIndex={switchDay}
    >
      {page === "command" && (
        <CommandCenter
          now={archiveNow}
          obs={obs}
          live={live}
          alerts={alerts}
          corridors={corridors}
          selectedId={selectedId}
          focusCamera={focusCam}
          onSelectVehicle={(id) => {
            setFocusCam(null);
            setSelectedId(id);
          }}
          onSelectCamera={(id) => {
            setFocusCam(id);
            const hit = [...obs].reverse().find((o) => o.cameraId === id);
            if (hit) setSelectedId(hit.vehicleId);
          }}
        />
      )}
      {page === "analytics" && <Analytics obs={obs} now={archiveNow} />}
      {page === "trajectories" && (
        <Trajectories
          query={query}
          selectedId={selectedId}
          onSelectVehicle={setSelectedId}
        />
      )}
      {page === "alerts" && <Alerts alerts={alerts} onPlate={selectPlate} />}
      {page === "cameras" && (
        <Cameras
          now={archiveNow}
          obs={obs}
          focusCamera={focusCam}
          onSelectCamera={(id) => {
            setFocusCam(id);
            setPage("command");
          }}
        />
      )}
    </Shell>
  );
}
