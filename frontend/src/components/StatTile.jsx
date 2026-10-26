export default function StatTile({ label, value, detail, tone }) {
  return (
    <div className={`metric${tone ? ` metric-${tone}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {detail && <div className="metric-detail">{detail}</div>}
    </div>
  );
}
