import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { COLORS } from "../theme.js";
import {
  addDays,
  dateLabel,
  dateTimeLabel,
  fmtMW,
  fmtMWh,
  fmtPct,
  fmtSigned,
  hourLabel,
} from "../format.js";
import StatTile from "./StatTile.jsx";
import ChartTooltip from "./ChartTooltip.jsx";

export default function DecisionView({ meta, decisionTime }) {
  const [day, setDay] = useState("2026-01-14");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showActual, setShowActual] = useState(true);
  const [showHindsight, setShowHindsight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .decision(day, decisionTime)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [day, decisionTime]);

  const points = data
    ? data.points.map((p, i) => ({
        ...p,
        hour: hourLabel(p.startTime),
        hindsight: data.hindsight[i]?.forecast,
        band: [p.bandLow, p.bandHigh],
      }))
    : [];

  const vintageRows = data
    ? data.history.map((h) => {
        const errors = h.points.map((p) => p.error);
        const mae = errors.reduce((a, e) => a + Math.abs(e), 0) / errors.length;
        return {
          publishTime: h.publishTime,
          total: h.points.reduce((a, p) => a + p.forecast, 0),
          mae,
          isUsed: h.publishTime === data.publishTime,
        };
      })
    : [];

  return (
    <section>
      <div className="toolbar">
        <label className="field">
          <span>Decision day</span>
          <input
            type="date"
            value={day}
            min={meta.firstDecisionDay}
            max={meta.lastDecisionDay}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
        </label>
        <div className="field-group">
          <button className="button" onClick={() => setDay(addDays(day, -1))} disabled={day <= meta.firstDecisionDay}>
            Previous day
          </button>
          <button className="button" onClick={() => setDay(addDays(day, 1))} disabled={day >= meta.lastDecisionDay}>
            Next day
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} />
          <span>Show what actually happened</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showHindsight} onChange={(e) => setShowHindsight(e.target.checked)} />
          <span>Show last forecast before each hour</span>
        </label>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {data && (
        <>
          <div className="headline">
            <h2>
              Buying for {dateLabel(data.deliveryDay)}, decided {dateTimeLabel(data.decisionAt)}
            </h2>
            <p className="muted">
              Latest forecast available at that moment was published {dateTimeLabel(data.publishTime)},{" "}
              {data.forecastAgeMinutes} minutes before gate closure. Forecasts issued later did not exist yet
              and are excluded.
            </p>
          </div>

          <div className="stat-grid">
            <StatTile
              label="Forecast wind energy for the day"
              value={fmtMWh(data.summary.forecastMwh)}
              detail="Sum of the 24 hourly forecasts"
            />
            <StatTile
              label="Typical error at this horizon"
              value={fmtMW(data.summary.p50AbsError != null ? avgBand(points) : null)}
              detail="Half-width of the shaded band, learned from January"
            />
            {showActual && (
              <>
                <StatTile
                  label="Actual wind energy"
                  value={fmtMWh(data.summary.actualMwh)}
                  detail="Elexon FUELHH, metered"
                />
                <StatTile
                  label="Forecast minus actual"
                  value={fmtSigned(data.summary.bias)}
                  detail={`Mean over the day, ${fmtPct(data.summary.nmaePct)} of mean output`}
                  tone={data.summary.bias > 0 ? "over" : "under"}
                />
              </>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Hourly wind generation, {dateLabel(data.deliveryDay)}</h3>
              <p className="muted">
                Shaded band: the range the outcome fell inside 80% of the time in January for forecasts
                made this far ahead.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: COLORS.axis }} interval={2} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => `${Math.round(v / 1000)} GW`}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      title={(d) => `${d.hour} GMT, ${d.horizonHours} h ahead`}
                      rows={(d) =>
                        [
                          ["Forecast", fmtMW(d.forecast), COLORS.forecast],
                          ["Expected range", `${fmtMW(d.bandLow)} to ${fmtMW(d.bandHigh)}`, COLORS.band],
                          showActual && ["Actual", fmtMW(d.actual), COLORS.actual],
                          showHindsight && ["Last forecast before hour", fmtMW(d.hindsight), COLORS.hindsight],
                        ].filter(Boolean)
                      }
                    />
                  }
                />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                <Area
                  type="monotone"
                  dataKey="band"
                  name="Expected range (P10 to P90)"
                  stroke="none"
                  fill={COLORS.band}
                  fillOpacity={0.35}
                  isAnimationActive={false}
                  legendType="rect"
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast available at decision"
                  stroke={COLORS.forecast}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {showActual && (
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual generation"
                    stroke={COLORS.actual}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {showHindsight && (
                  <Line
                    type="monotone"
                    dataKey="hindsight"
                    name="Last forecast before each hour"
                    stroke={COLORS.hindsight}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>How the forecast moved before gate closure</h3>
              <p className="muted">
                Every vintage covering {dateLabel(data.deliveryDay)} that existed before the decision. The
                marked row is the one the desk would have used.
              </p>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Published</th>
                  <th className="num">Forecast for the day</th>
                  {showActual && <th className="num">Mean absolute error</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vintageRows.map((r) => (
                  <tr key={r.publishTime} className={r.isUsed ? "row-used" : ""}>
                    <td>{dateTimeLabel(r.publishTime)}</td>
                    <td className="num">{fmtMWh(r.total)}</td>
                    {showActual && <td className="num">{fmtMW(r.mae)}</td>}
                    <td>{r.isUsed ? <span className="tag">Used for decision</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="card details">
            <summary>Hourly table</summary>
            <table className="table">
              <thead>
                <tr>
                  <th>Hour</th>
                  <th className="num">Horizon</th>
                  <th className="num">Forecast</th>
                  <th className="num">Expected low</th>
                  <th className="num">Expected high</th>
                  {showActual && <th className="num">Actual</th>}
                  {showActual && <th className="num">Error</th>}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.startTime}>
                    <td>{p.hour}</td>
                    <td className="num">{p.horizonHours} h</td>
                    <td className="num">{fmtMW(p.forecast)}</td>
                    <td className="num">{fmtMW(p.bandLow)}</td>
                    <td className="num">{fmtMW(p.bandHigh)}</td>
                    {showActual && <td className="num">{fmtMW(p.actual)}</td>}
                    {showActual && <td className="num">{fmtSigned(p.error)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

function avgBand(points) {
  const widths = points.filter((p) => p.bandLow != null).map((p) => (p.bandHigh - p.bandLow) / 2);
  if (!widths.length) return null;
  return widths.reduce((a, w) => a + w, 0) / widths.length;
}
