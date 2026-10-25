export default function StatTile({ label, value, detail, tone }) {
  return (
    <div className={`stat-tile${tone ? ` stat-tile-${tone}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}
