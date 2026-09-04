import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CAMERA_SHORT, cameraThroughput, hourlyVolume, odMatrix, speedByHour, typeMix } from "../lib/analytics";
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

export function ChartsDock({ obs, now }: { obs: Observation[]; now: number }) {
  const hourly = hourlyVolume(obs);
  const mix = typeMix(obs);
  const cams = cameraThroughput(obs);
  const speed = speedByHour(now);
  const od = odMatrix(now);
  const maxOd = Math.max(1, ...Object.values(od.grid));

  return (
    <div className="dock">
      <section className="panel chart-box">
        <div className="panel-h">Traffic flow · hourly observations</div>
        <div className="panel-b">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3ee0ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3ee0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#8ea0b8", fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: "#8ea0b8", fontSize: 10 }} width={28} />
              <Tooltip {...tooltip} />
              <Area type="monotone" dataKey="count" stroke="#3ee0ff" fill="url(#flow)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel chart-box">
        <div className="panel-h">Fleet mix</div>
        <div className="panel-b">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mix} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                {mix.map((_, i) => (
                  <Cell key={i} fill={PIE[i % PIE.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel chart-box">
        <div className="panel-h">Avg speed · km/h</div>
        <div className="panel-b">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={speed}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "#8ea0b8", fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: "#8ea0b8", fontSize: 10 }} width={28} />
              <Tooltip {...tooltip} />
              <Bar dataKey="kmh" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel chart-box">
        <div className="panel-h">Origin → destination</div>
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
          <div className="meta" style={{ marginTop: 8 }}>
            Throughput: {cams.map((c) => `${c.name.split(" ")[0]} ${c.count}`).join(" · ")}
          </div>
        </div>
      </section>
    </div>
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
