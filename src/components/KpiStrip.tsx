type Item = { label: string; value: string | number; hint: string; danger?: boolean };

export function KpiStrip({ items }: { items: Item[] }) {
  return (
    <div className="kpis">
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <span>{k.label}</span>
          <b style={{ color: k.danger ? "var(--rose)" : undefined }}>{k.value}</b>
          <em>{k.hint}</em>
        </div>
      ))}
    </div>
  );
}
