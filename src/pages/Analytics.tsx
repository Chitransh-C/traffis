import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiStrip } from "../components/KpiStrip";
import { VEHICLES } from "../data/load";
import {
  CAMERA_SHORT,
  alertBreakdown,
  avgSpeedUntil,
  cameraThroughput,
  elapsedHours,
  hourlyVolume,
  odMatrix,
  peakHourLabel,
  speedByHour,
  topOdPairs,
  typeMix,
} from "../lib/analytics";
import type { Observation } from "../types";

const tooltip = {
  contentStyle: {
    background: "#0b1220",
    border: "1px solid rgba(94,234,212,0.2)",
    borderRadius: 8,
    fontSize: 12,
  },
};
const PIE = ["#3ee0ff", "#2dd4bf", "#b49cff", "#f5c15a", "#ff6b8a"];

export function Analytics({ obs, now }: { obs: Observation[]; now: number }) {
  const cut = elapsedHours(now) + 1;
  const hourly = hourlyVolume(obs, now).slice(0, cut);
  const mix = typeMix(obs);
  const cams = cameraThroughput(obs);
  const speed = speedByHour(now).slice(0, cut);
  const od = odMatrix(now);
  const maxOd = Math.max(1, ...Object.values(od.grid));
  const peak = peakHourLabel(obs, now);
  const alerts = alertBreakdown(now);
  const topRoutes = topOdPairs(now);
  const plates = new Set(obs.map((o) => o.canonicalPlate)).size;
  const mixTotal = mix.reduce((s, d) => s + d.value, 0);

  return (
    <div className="analytics">
      <div className="analytics-kpis">
        <KpiStrip
          items={[
            { label: "Events so far", value: obs.length, hint: "ANPR observations" },
            { label: "Unique plates", value: plates, hint: `of ${VEHICLES.length} in fleet` },
            { label: "Mean speed", value: `${avgSpeedUntil(now).toFixed(1)} km/h`, hint: "from reconstructed hops" },
            { label: "Peak hour", value: peak, hint: "highest observation count" },
          ]}
        />
      </div>

      <section className="panel span-2">
        <div className="panel-h">Traffic flow · hourly observations · peak {peak}</div>
        <div className="panel-b chart-body lg">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="flow2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3ee0ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3ee0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#8ea0b8", fontSize: 11 }} interval={0} />
              <YAxis tick={{ fill: "#8ea0b8", fontSize: 11 }} width={32} />
              <Tooltip {...tooltip} />
              <Area type="monotone" dataKey="count" stroke="#3ee0ff" fill="url(#flow2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">Fleet mix · {mixTotal} vehicles seen</div>
        <div className="panel-b mix-body">
          {mix.length ? (
            <>
              <div className="mix-donut-wrap">
                <FleetDonut mix={mix} />
              </div>
              <div className="mix-legend">
                {mix.map((d, i) => (
                  <div key={d.name}>
                    <i style={{ background: PIE[i % PIE.length] }} />
                    <span>
                      {d.name} · {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">No vehicles observed yet at this timestamp.</div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">Avg speed · km/h</div>
        <div className="panel-b chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={speed}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#8ea0b8", fontSize: 11 }} interval={0} />
              <YAxis tick={{ fill: "#8ea0b8", fontSize: 11 }} width={32} />
              <Tooltip {...tooltip} />
              <Bar dataKey="kmh" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">Camera utilization</div>
        <div className="panel-b chart-body cam">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cams} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8ea0b8", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#8ea0b8", fontSize: 10 }} width={108} />
              <Tooltip {...tooltip} />
              <Bar dataKey="count" fill="#b49cff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">Alert mix</div>
        <div className="panel-b chart-body">
          {alerts.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alerts}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#8ea0b8", fontSize: 10 }} interval={0} />
                <YAxis tick={{ fill: "#8ea0b8", fontSize: 11 }} width={28} />
                <Tooltip {...tooltip} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {alerts.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty">No alerts yet.</div>
          )}
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-h">Origin → destination matrix</div>
        <div className="panel-b">
          <div className="od">
            <div />
            {od.ids.map((id) => (
              <div className="h" key={id}>
                {CAMERA_SHORT[id] ?? id.slice(-3)}
              </div>
            ))}
            {od.ids.map((row) => (
              <OdRow key={row} row={row} ids={od.ids} grid={od.grid} max={maxOd} />
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">Busiest OD pairs</div>
        <div className="panel-b">
          {topRoutes.length ? (
            <div className="feed">
              {topRoutes.map((r) => (
                <div className="feed-item" key={r.route}>
                  <div className="row">
                    <strong>{r.route}</strong>
                    <span className="tag">{r.trips} trips</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Need two or more camera hits to form an OD pair.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

function donutSlice(cx: number, cy: number, ir: number, or: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, or, a0);
  const [x1, y1] = polar(cx, cy, or, a1);
  const [x2, y2] = polar(cx, cy, ir, a1);
  const [x3, y3] = polar(cx, cy, ir, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${or} ${or} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`;
}

function FleetDonut({ mix }: { mix: { name: string; value: number }[] }) {
  const total = mix.reduce((s, d) => s + d.value, 0);
  const gap = mix.length > 1 ? 3 : 0;
  let cursor = 0;
  const slices = mix.map((d, i) => {
    const sweep = (d.value / total) * 360;
    const a0 = cursor + gap / 2;
    const a1 = cursor + sweep - gap / 2;
    cursor += sweep;
    return { ...d, a0, a1, fill: PIE[i % PIE.length] };
  });

  return (
    <svg className="mix-donut" viewBox="0 0 200 200" role="img" aria-label="Fleet mix">
      {slices.map((s) => {
        if (s.a1 - s.a0 >= 359) {
          return (
            <g key={s.name}>
              <path d={donutSlice(100, 100, 58, 86, 0, 180)} fill={s.fill} />
              <path d={donutSlice(100, 100, 58, 86, 180, 360)} fill={s.fill} />
            </g>
          );
        }
        if (s.a1 <= s.a0) return null;
        return <path key={s.name} d={donutSlice(100, 100, 58, 86, s.a0, s.a1)} fill={s.fill} />;
      })}
      <text x="100" y="94" textAnchor="middle" className="mix-donut-n">
        {total}
      </text>
      <text x="100" y="114" textAnchor="middle" className="mix-donut-l">
        vehicles
      </text>
    </svg>
  );
}

function OdRow({
  row,
  ids,
  grid,
  max,
}: {
  row: string;
  ids: string[];
  grid: Record<string, number>;
  max: number;
}) {
  return (
    <>
      <div className="lab">{CAMERA_SHORT[row] ?? row.slice(-3)}</div>
      {ids.map((col) => {
        const n = grid[`${row}|${col}`];
        const t = n / max;
        const bg = n === 0 ? "#122033" : `rgba(62,224,255,${0.18 + t * 0.75})`;
        return (
          <div className="cell" key={col} style={{ background: bg, color: t > 0.55 ? "#041018" : "#d7ecff" }}>
            {n || ""}
          </div>
        );
      })}
    </>
  );
}
