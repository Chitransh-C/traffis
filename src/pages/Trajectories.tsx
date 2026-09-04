import { useEffect, useMemo, useState } from "react";
import { MapPinned, Search } from "lucide-react";
import { TrackMap } from "../components/TrackMap";
import { CAMERA_MAP, VEHICLE_MAP } from "../data/load";
import { istAt, istHm, metaDays } from "../lib/clock";
import { formatHour, formatStamp } from "../lib/geo";
import {
  hypothesesForTrack,
  hyposByHop,
  lastSeenZone,
  topHypothesis,
  visibleHypotheses,
} from "../lib/routeEngine";
import { hitsInWindow, matchVehicles, trackPath } from "../lib/track";
import type { Vehicle } from "../types";

type Props = {
  query: string;
  selectedId: string | null;
  onSelectVehicle: (id: string) => void;
};

export function Trajectories({ query, selectedId, onSelectVehicle }: Props) {
  const days = metaDays();
  const todayIso = days.at(-1)?.iso ?? days[0]?.iso ?? "";
  const [plate, setPlate] = useState(query);
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [fromTime, setFromTime] = useState("06:00");
  const [toTime, setToTime] = useState("22:00");
  const [widened, setWidened] = useState<string | null>(null);
  const [matches, setMatches] = useState<Vehicle[]>([]);
  const [activeId, setActiveId] = useState<string | null>(selectedId);
  const [searched, setSearched] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [plotKey, setPlotKey] = useState(0);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [focusHop, setFocusHop] = useState(0);
  const [selectedHypoId, setSelectedHypoId] = useState<string | null>(null);
  const [showZone, setShowZone] = useState(true);

  useEffect(() => {
    if (query.trim()) setPlate(query);
  }, [query]);

  const from = istAt(fromDate, fromTime);
  const to = istAt(toDate, toTime);
  const windowOk = Number.isFinite(from) && Number.isFinite(to) && to > from;

  const hits = useMemo(
    () => (activeId && windowOk ? hitsInWindow(activeId, from, to) : []),
    [activeId, from, to, windowOk],
  );
  const path = useMemo(() => trackPath(hits), [hits]);
  const vehicle = activeId ? VEHICLE_MAP[activeId] : null;
  const hypotheses = useMemo(
    () => (vehicle && hits.length > 1 ? hypothesesForTrack(hits, vehicle) : []),
    [vehicle, hits],
  );
  const grouped = useMemo(() => hyposByHop(hypotheses), [hypotheses]);
  const defaultFocus = useMemo(() => {
    for (const [hop, list] of grouped) {
      if (list.length > 1) return hop;
    }
    return 0;
  }, [grouped]);
  const drawn = useMemo(
    () => visibleHypotheses(hypotheses, showAllPaths, focusHop),
    [hypotheses, showAllPaths, focusHop],
  );
  const focusList = grouped.get(focusHop) ?? [];
  const fromCam = hits[focusHop];
  const toCam = hits[focusHop + 1];
  const zone = useMemo(() => {
    const last = hits.at(-1);
    if (!vehicle || !last) return null;
    return lastSeenZone(last, vehicle, to);
  }, [hits, vehicle, to]);

  const runSearch = (nextPlate = plate, pickId?: string) => {
    const found = matchVehicles(nextPlate);
    setMatches(found);
    setSearched(true);
    setShowMap(false);
    setWidened(null);
    setShowAllPaths(false);
    setSelectedHypoId(null);
    const pick = pickId
      ? found.find((v) => v.id === pickId)
      : found.length === 1
        ? found[0]
        : found.find((v) => v.id === activeId) ?? found[0];
    setActiveId(pick?.id ?? null);
    if (pick) onSelectVehicle(pick.id);

    if (!pick) return;
    const chosenFrom = istAt(fromDate, fromTime);
    const chosenTo = istAt(toDate, toTime);
    const inWindow = hitsInWindow(pick.id, chosenFrom, chosenTo);
    if (inWindow.length) return;
    const spanHits = hitsInWindow(pick.id, istAt(fromDate, "00:00"), istAt(toDate, "23:59"));
    if (!spanHits.length) return;
    const first = spanHits[0].timestamp;
    const last = spanHits[spanHits.length - 1].timestamp;
    setFromTime(istHm(first));
    setToTime(istHm(last));
    setWidened(
      `No hits in that clock window. Showing ${spanHits.length} hits ${istHm(first)}–${istHm(last)} in the selected dates.`,
    );
  };

  const plotOnMap = () => {
    if (!hits.length) return;
    setShowMap(true);
    setFocusHop(defaultFocus);
    const top = topHypothesis(grouped.get(defaultFocus) ?? []);
    setSelectedHypoId(top?.id ?? null);
    setPlotKey((n) => n + 1);
  };

  const pickHop = (hop: number) => {
    const max = Math.max(0, hits.length - 2);
    const next = Math.min(Math.max(0, hop), max);
    setFocusHop(next);
    const top = topHypothesis(grouped.get(next) ?? []);
    setSelectedHypoId(top?.id ?? null);
  };

  return (
    <div className="track-page">
      <form
        className="track-bar"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <label className="track-field grow">
          <span>Plate</span>
          <div className="track-search">
            <Search size={14} />
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="MP07WL0001 or MP007"
              autoComplete="off"
            />
          </div>
        </label>
        <label className="track-field">
          <span>From date</span>
          <select
            className="day-select"
            value={fromDate}
            onChange={(e) => {
              const next = e.target.value;
              setFromDate(next);
              if (next > toDate) setToDate(next);
            }}
          >
            {days.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="track-field">
          <span>From</span>
          <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
        </label>
        <label className="track-field">
          <span>To date</span>
          <select
            className="day-select"
            value={toDate}
            onChange={(e) => {
              const next = e.target.value;
              setToDate(next);
              if (next < fromDate) setFromDate(next);
            }}
          >
            {days.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="track-field">
          <span>To</span>
          <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
        </label>
        <button type="submit" className="track-go" disabled={!plate.trim() || !windowOk}>
          Track
        </button>
        <button
          type="button"
          className="track-map-btn"
          disabled={!hits.length}
          onClick={plotOnMap}
          title="Plot movement on map"
        >
          <MapPinned size={16} />
          Plot on map
        </button>
      </form>

      <div className={`track-body${showMap ? "" : " solo"}`}>
        <section className="panel">
          <div className="panel-h">
            <span>
              {vehicle
                ? `${vehicle.plate} · ${hits.length} camera hits`
                : searched
                  ? "Search results"
                  : "Vehicle track"}
            </span>
            {vehicle?.watchlist && <span className="tag crit">watchlist</span>}
          </div>
          <div className="panel-b">
            {!windowOk && <div className="empty">To date/time must be after from date/time.</div>}
            {searched && matches.length > 1 && (
              <div className="match-row">
                {matches.map((v) => (
                  <button
                    key={v.id}
                    className={`chip${activeId === v.id ? " on" : ""}`}
                    onClick={() => runSearch(v.plate, v.id)}
                  >
                    {v.plate}
                  </button>
                ))}
              </div>
            )}
            {searched && !matches.length && (
              <div className="empty">No plate matched “{plate}”. Try MP07 or the last four digits.</div>
            )}
            {vehicle && (
              <div className="meta" style={{ marginBottom: 10 }}>
                <span>
                  {vehicle.color} {vehicle.type} · {vehicle.ownerHint}
                </span>
                <span>
                  {formatStamp(from)} – {formatStamp(to)}
                </span>
              </div>
            )}
            {widened && <div className="track-note">{widened}</div>}
            {vehicle && !hits.length && (
              <div className="empty">
                This plate has no camera hits in {days.find((d) => d.iso === fromDate)?.label ?? fromDate}
                {fromDate !== toDate ? ` – ${days.find((d) => d.iso === toDate)?.label ?? toDate}` : ""}. Try another
                span in Sat 29 Aug – Fri 4 Sept.
              </div>
            )}
            {hits.length > 0 && (
              <div className="hit-list">
                {hits.map((o, i) => {
                  const cam = CAMERA_MAP[o.cameraId];
                  const prev = hits[i - 1];
                  const gap = prev ? Math.round((o.timestamp - prev.timestamp) / 60_000) : null;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`hit-row${showMap && (i === focusHop || i === focusHop + 1) ? " on" : ""}`}
                      onClick={() => pickHop(i < hits.length - 1 ? i : i - 1)}
                    >
                      <div className="hit-n">{i + 1}</div>
                      <div>
                        <div className="row">
                          <strong>{cam?.name ?? o.cameraId}</strong>
                          <span className="tag">{o.cameraId}</span>
                        </div>
                        <div className="meta">
                          <span>{formatStamp(o.timestamp)}</span>
                          <span>{(o.confidence * 100).toFixed(0)}% OCR</span>
                        </div>
                        {gap != null && <div className="meta">+{gap} min from previous camera</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {showMap && showZone && zone && (
              <div className="hypo-card">
                <div className="panel-h sub">Last-seen zone</div>
                <div className="track-note">
                  Last camera {zone.name} at {formatHour(zone.lastTs)}. Pinpoint around that node
                  (~{Math.round(zone.likelyRadiusM)} m likely / {Math.round(zone.possibleRadiusM)} m possible).
                  Next cameras: {zone.reachable.map((r) => r.name).join(", ") || "none on graph"}.
                </div>
                {zone.reachable.length > 0 && (
                  <div className="meta" style={{ marginTop: 8 }}>
                    {zone.reachable.map((r) => `${r.name} (~${r.estMin} min)`).join(" · ")}
                  </div>
                )}
              </div>
            )}
            {showMap && showAllPaths && focusList.length > 0 && fromCam && toCam && (
              <div className="hypo-card">
                <div className="panel-h sub">
                  Paths · {CAMERA_MAP[fromCam.cameraId]?.name} → {CAMERA_MAP[toCam.cameraId]?.name}
                </div>
                {focusList.map((h) => {
                  const via =
                    h.cameras
                      .slice(1, -1)
                      .map((id) => CAMERA_MAP[id]?.name ?? id)
                      .join(" · ") || "direct";
                  return (
                    <button
                      key={h.id}
                      type="button"
                      className={`hypo-row${selectedHypoId === h.id ? " on" : ""}`}
                      onClick={() => setSelectedHypoId(h.id)}
                    >
                      <i style={{ background: h.color }} />
                      <div>
                        <div className="row">
                          <strong>{(h.p * 100).toFixed(0)}%</strong>
                          <span className="tag">{h.kind}</span>
                        </div>
                        <div className="meta">
                          <span>via {via}</span>
                          <span>
                            {h.estMin} min · {h.km} km
                          </span>
                        </div>
                        <div className="meta">{h.reasons[0]}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {!searched && (
              <div className="empty">
                Search a plate and set date / from / to. Defaults cover 06:00–22:00. Then Plot on map.
              </div>
            )}
          </div>
        </section>

        {showMap && (
          <section className="panel map-wrap">
            <div className="panel-h">
              <span>Movement · {vehicle?.plate ?? "—"}</span>
              <div className="style-switch">
                <button
                  type="button"
                  className={showAllPaths ? "" : "on"}
                  onClick={() => setShowAllPaths(false)}
                >
                  Story
                </button>
                <button
                  type="button"
                  className={showAllPaths ? "on" : ""}
                  onClick={() => {
                    setShowAllPaths(true);
                    pickHop(focusHop);
                  }}
                >
                  All possible paths
                </button>
                <button type="button" className={showZone ? "on" : ""} onClick={() => setShowZone((v) => !v)}>
                  Last-seen zone
                </button>
              </div>
            </div>
            <TrackMap
              hits={hits}
              hypotheses={drawn}
              fallbackPath={path}
              plotKey={plotKey}
              showAllPaths={showAllPaths}
              showZone={showZone}
              zone={zone}
              focusHop={focusHop}
              selectedHypoId={selectedHypoId}
              onFocusHop={pickHop}
            />
            <div className="track-legend">
              <span><i style={{ background: "#0891b2" }} /> Likely</span>
              <span><i style={{ background: "#d97706" }} /> Possible</span>
              {showZone && (
                <span><i style={{ background: "rgba(8,145,178,0.45)" }} /> Last-seen zone</span>
              )}
              {showAllPaths && (
                <>
                  <span><i className="dash" style={{ background: "#e11d48" }} /> Unlikely</span>
                  <span><i className="dash" style={{ background: "#64748b" }} /> Blocked</span>
                </>
              )}
              <span className="dim">
                {showAllPaths
                  ? "Click a camera hit to inspect that hop"
                  : "Turn on All possible paths to compare corridors"}
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
