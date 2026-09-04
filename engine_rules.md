# Camera route hypothesis engine

If cameras **A** and **C** fire and **B** is silent, the vehicle either **passed B and ANPR missed** or **took another corridor that never sees B**. The engine compares those stories. It is a demo on the 12-camera Gwalior graph — not a production GIS router.

---

## Walkthrough

1. Plate track gives an ordered list of hits.
2. For each consecutive pair **A → C**, enumerate simple camera paths A ⇢ C (max 4 hops).
3. Each path is a hypothesis: stitch known road polylines, score it, color it.
4. A path that goes A → B → C while B has no hit is a **missed capture** (or a degraded node).
5. A path A → D → C that never visits B is an **alternate route**.
6. Hover a colored line: estimated clock at that point (lerp from A’s time to C’s time by distance), skipped cameras, and a one-line reason.

Independent hops only. The engine does **not** yet solve the whole day as one assignment.

---

## Implemented in this demo

Graph: 12 cameras, undirected neighbor edges in `src/data/network.json`. No live OSRM. Geometry is pre-fetched corridor polylines stitched along the camera sequence.

Limits: simple paths only (no cycles), **max 4 hops**, **at most 6 paths** per A→C pair, then keep the shortest by km.

### Scoring

| Signal | Rule |
| --- | --- |
| Distance / time | `expectedMin = Σ (edgeKm / speed(type, hour, class))`. Score falls when observed minutes A→C are much faster or slower than that path (`abs(obs/exp − 1)`). |
| Cruise speed | Bike ~28 km/h, car/auto ~30, truck/bus ~22. |
| Peak hour | 08:00–10:00 and 17:00–20:00 IST: arterial and corridor expected time × **1.35**. |
| Vehicle vs lane | Truck/bus **blocked** (`p = 0`) on `class: narrow` or `lanes < 2` or `truckOk: false`. |
| Bike | Small bonus (lower cost) if the path uses `narrow` or `market` edges. |
| Skipped cameras | Mid-path cameras with no hit. If the camera is **online**, a **short** path that includes it is treated as a **miss** (time must still fit). A **longer** path that avoids it is an **alternate**. **Degraded** cameras (e.g. CAM_081) raise miss probability (lower skip penalty). |
| Softmax | `p_i = exp(−cost_i) / Σ exp(−cost)` over non-blocked paths. Blocked stay at 0. |
| Colors | **Likely** p ≥ 0.45 cyan · **Possible** p ≥ 0.20 amber · **Unlikely** rose · **Blocked** slate. |

Arrows are drawn only on the **highest-p** non-blocked path so the main story stays readable.

### Last-seen zone

After the **last** camera hit, the vehicle is no longer on a known hop. The demo draws a **pinpoint** around that camera (not a city-wide disc):

- **Likely (cyan):** about 160–280 m (camera FOV / just left the node).
- **Possible (amber):** about 240–400 m. Growth stops after 4 minutes of elapsed time.
- Neighbor cameras on the graph are listed as the next pinch points. Trucks skip narrow / no-truck edges.

Toggle **Last-seen zone** on the map header. Track accepts a **from date + to date** as well as times.

### Edge classes (demo tags)

- `arterial` — wider roads (NH / City Centre / Airport approach). Trucks preferred.
- `corridor` — normal 3-lane city links. Trucks OK.
- `market` — old-city / Lashkar. Slower. Bikes slightly favored.
- `narrow` — 1–2 effective lanes. **Trucks/buses blocked.**

---

## Rules to add later (not implemented)

These belong in a production engine. Listed so the demo does not pretend they exist.

### Geometry and traffic

- OSRM / Valhalla **alternatives** (`alternatives=true`) and `continue_straight` so two ways exist between the **same** camera pair without inventing extra nodes.
- One-way streets, turn restrictions, U-turn bans, flyover vs service road.
- Legal width vs physical width; height/clearance (trucks vs rail overbridges).
- Bus-only, no-truck, school-hour, odd-even, VIP closure windows.
- Weather, visibility, waterlogging (Gwalior monsoon).
- Time-of-day speed from measured ANPR hops, not a 1.35 peak factor.
- Historical **OD priors**: how often this plate class actually uses this corridor.

### Capture and identity

- ANPR FOV / OCR miss model (angle, speed, plate dirt, night IR).
- Plate transfer, clone, or swap (same glyphs, different vehicle).
- Partial plate match vs canonical plate.
- Camera clock skew between nodes.

### Motion

- **Dwell**: stopped at Junction / market; observed time much longer than free-flow is not always a detour.
- GPS probe vs camera snap (we have no GPS; do not fake traces).
- Kalman / HMM along the polyline between cameras.
- **Multi-hop global assignment**: one path for the whole day, not independent A→C pairs (avoids flip-flopping at every hop).

### Operational

- Force-open / force-close an edge from the command UI.
- Operator override: “treat B as missed” vs “treat as detour.”
- Audit log of which rule decided the color.
