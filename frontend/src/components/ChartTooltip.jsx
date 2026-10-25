export default function ChartTooltip({ active, payload, label, title, rows }) {
  if (!active || !payload || !payload.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{title ? title(datum, label) : label}</div>
      {rows(datum).map(([name, value, color]) => (
        <div className="tooltip-row" key={name}>
          <span className="tooltip-swatch" style={{ background: color || "transparent" }} />
          <span className="tooltip-name">{name}</span>
          <span className="tooltip-value">{value}</span>
        </div>
      ))}
    </div>
  );
}
