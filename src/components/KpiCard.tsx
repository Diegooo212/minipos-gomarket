interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: string;
}

export default function KpiCard({ label, value, sub, valueColor }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}