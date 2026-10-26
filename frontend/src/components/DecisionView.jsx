import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { ScrollTrigger } from "../motion.js";
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
import { Loading } from "./Turbine.jsx";
import VintageTimeline from "./VintageTimeline.jsx";

const Chevron = ({ direction }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d={direction === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
      .then((d) => {
        if (cancelled) return;
        setData(d);
        requestAnimationFrame(() => ScrollTrigger.refresh());
      })
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
    <div className="view">
      <div className="section-head">
        <div>
          <p className="kicker">day-ahead desk</p>
          <h2 className="h2" id="desk-title">Pick a day. See only what the desk could see.</h2>
        </div>
        <div>
          <p className="lead">
            Pick a decision day. The desk shows the newest Elexon forecast that existed at gate closure, the wind to
            plan for once the known bias is removed, and the range the outcome usually falls in. Nothing published
            later is used.
          </p>
          <p className="scope">Pilot scope: purchase decisions made in January 2026, from a fixed Elexon snapshot. Not live data.</p>
        </div>
      </div>

      <div className="controls" data-reveal>
        <div className="stepper">
          <span className="stepper-label">decision day</span>
          <button
            className="btn btn-line btn-icon"
            onClick={() => setDay(addDays(day, -1))}
            disabled={day <= meta.firstDecisionDay}
            aria-label="Previous day"
          >
            <Chevron direction="left" />
          </button>
          <input
            type="date"
            value={day}
            min={meta.firstDecisionDay}
            max={meta.lastDecisionDay}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            aria-label="Decision day"
          />
          <button
            className="btn btn-line btn-icon"
            onClick={() => setDay(addDays(day, 1))}
            disabled={day >= meta.lastDecisionDay}
            aria-label="Next day"
          >
            <Chevron direction="right" />
          </button>
        </div>
        <div className="chips">
          <button
            className="chip"
            aria-pressed={showActual}
            onClick={() => setShowActual((v) => !v)}
            style={{ "--chip-colour": COLORS.actual }}
          >
            <span className="chip-dot" />
            What actually happened
          </button>
          <button
            className="chip"
            aria-pressed={showHindsight}
            onClick={() => setShowHindsight((v) => !v)}
            style={{ "--chip-colour": COLORS.band }}
          >
            <span className="chip-dot" />
            Last forecast before each hour
          </button>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {!data && !error && <Loading label="fetching the forecast" />}

      {data && (
        <>
          <div className="panel" data-reveal>
            <div>
              <p className="kicker">decided {dateTimeLabel(data.decisionAt).toLowerCase()}</p>
              <h2 className="panel-title">Buying for {dateLabel(data.deliveryDay)}</h2>
              <p className="panel-note">
                The newest forecast at that moment was published {dateTimeLabel(data.publishTime)}, {data.forecastAgeMinutes}{" "}
                minutes before gate closure. Forecasts issued later did not exist yet and are not used.
              </p>
              <span className="panel-tag">
                {data.history.length} forecast {data.history.length === 1 ? "issue" : "issues"} existed before the decision
              </span>
            </div>
            <dl className="metrics">
              <StatTile
                label="forecast says"
                value={fmtMWh(data.summary.forecastMwh)}
                detail="Sum of the 24 hourly forecasts, as published"
                tone="plain"
              />
              <StatTile
                label="wind to plan for"
                value={fmtMWh(data.summary.planForMwh)}
                detail={
                  data.bias.days > 0
                    ? `Forecast minus the ${fmtMW(data.bias.bias)} it ran high over the ${data.bias.days} earlier ${data.bias.days === 1 ? "day" : "days"}`
                    : "No earlier days to learn from yet, so the raw forecast"
                }
              />
              <StatTile
                label="typical miss at this lead time"
                value={fmtMW(avgBand(points))}
                detail="Half-width of the shaded range on the chart"
                tone="plain"
              />
              {showActual && (
                <>
                  <StatTile
                    label="what the wind did"
                    value={fmtMWh(data.summary.actualMwh)}
                    detail="Elexon FUELHH, metered"
                    tone="plain"
                  />
                  <StatTile
                    label="forecast minus actual"
                    value={fmtSigned(data.summary.bias)}
                    detail={`Average per hour. ${data.summary.bias > 0 ? "Forecast ran high" : "Forecast ran low"}, ${fmtPct(data.summary.nmaePct)} of the wind`}
                    tone={data.summary.bias > 0 ? "over" : "under"}
                  />
                  <StatTile
                    label="plan-for minus actual"
                    value={fmtSigned(data.summary.corrected.bias)}
                    detail={
                      data.bias.days > 0
                        ? `Typical miss ${fmtMW(data.summary.corrected.mae)} instead of ${fmtMW(data.summary.mae)}`
                        : "Same as the forecast on this day"
                    }
                    tone={Math.abs(data.summary.corrected.bias) < Math.abs(data.summary.bias) ? "good" : "plain"}
                  />
                </>
              )}
            </dl>
          </div>

          <div className="figure" data-reveal>
            <div className="figure-head">
              <h3 className="h3">Hourly wind generation, {dateLabel(data.deliveryDay)}</h3>
              <p className="lead">
                The band is where the outcome landed 80% of the time in January for forecasts made this far ahead.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12, fill: COLORS.tick, fontFamily: "var(--mono)" }}
                  tickLine={false}
                  axisLine={{ stroke: COLORS.axis }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: COLORS.tick, fontFamily: "var(--mono)" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => `${Math.round(v / 1000)} GW`}
                />
                <Tooltip
                  cursor={{ stroke: COLORS.axis }}
                  content={
                    <ChartTooltip
                      title={(d) => `${d.hour} gmt, ${d.horizonHours} h ahead`}
                      rows={(d) =>
                        [
                          ["Forecast says", fmtMW(d.forecast), COLORS.forecast],
                          data.bias.days > 0 && ["Wind to plan for", fmtMW(d.planFor), COLORS.plan],
                          ["Expected range", `${fmtMW(d.bandLow)} to ${fmtMW(d.bandHigh)}`, COLORS.band],
                          showActual && ["Actual", fmtMW(d.actual), COLORS.actual],
                          showHindsight && ["Last forecast before hour", fmtMW(d.hindsight), COLORS.hindsight],
                        ].filter(Boolean)
                      }
                    />
                  }
                />
                <Area type="monotone" dataKey="band" stroke="none" fill={COLORS.band} fillOpacity={0.55} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke={COLORS.forecast}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#f4f2ee" }}
                  isAnimationActive={false}
                />
                {data.bias.days > 0 && (
                  <Line
                    type="monotone"
                    dataKey="planFor"
                    stroke={COLORS.plan}
                    strokeWidth={1.75}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {showActual && (
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={COLORS.actual}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#f4f2ee" }}
                    isAnimationActive={false}
                  />
                )}
                {showHindsight && (
                  <Line
                    type="monotone"
                    dataKey="hindsight"
                    stroke={COLORS.hindsight}
                    strokeWidth={1.75}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: COLORS.forecast }} />
                forecast as published
              </span>
              {data.bias.days > 0 && (
                <span className="legend-item">
                  <span className="legend-swatch legend-swatch-dashed" style={{ color: COLORS.plan }} />
                  wind to plan for, bias removed
                </span>
              )}
              <span className="legend-item">
                <span className="legend-swatch legend-swatch-area" style={{ background: COLORS.band }} />
                expected range, p10 to p90
              </span>
              {showActual && (
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: COLORS.actual }} />
                  actual generation
                </span>
              )}
              {showHindsight && (
                <span className="legend-item">
                  <span className="legend-swatch legend-swatch-dashed" style={{ color: COLORS.hindsight }} />
                  last forecast before each hour
                </span>
              )}
            </div>
          </div>

          <div className="figure" data-reveal>
            <div className="figure-head">
              <h3 className="h3">How the forecast moved before gate closure</h3>
              <p className="lead">
                Every issue covering {dateLabel(data.deliveryDay)} that existed before the decision. The highlighted
                row is the one the desk would have used.
              </p>
            </div>
            <VintageTimeline
              history={data.history}
              decisionAt={data.decisionAt}
              publishTime={data.publishTime}
              deliveryDay={data.deliveryDay}
            />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>published</th>
                    <th className="num">forecast for the day</th>
                    {showActual && <th className="num">mean absolute error</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {vintageRows.map((r) => (
                    <tr key={r.publishTime} className={r.isUsed ? "row-used" : ""}>
                      <td>{dateTimeLabel(r.publishTime)}</td>
                      <td className="num">{fmtMWh(r.total)}</td>
                      {showActual && <td className="num">{fmtMW(r.mae)}</td>}
                      <td className="num">{r.isUsed ? <span className="tag">used for decision</span> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <details className="details" data-reveal>
            <summary>hourly table</summary>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>hour</th>
                    <th className="num">lead time</th>
                    <th className="num">forecast</th>
                    <th className="num">plan for</th>
                    <th className="num">expected low</th>
                    <th className="num">expected high</th>
                    {showActual && <th className="num">actual</th>}
                    {showActual && <th className="num">error</th>}
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.startTime}>
                      <td>{p.hour}</td>
                      <td className="num">{p.horizonHours} h</td>
                      <td className="num">{fmtMW(p.forecast)}</td>
                      <td className="num">{fmtMW(p.planFor)}</td>
                      <td className="num">{fmtMW(p.bandLow)}</td>
                      <td className="num">{fmtMW(p.bandHigh)}</td>
                      {showActual && <td className="num">{fmtMW(p.actual)}</td>}
                      {showActual && <td className="num">{fmtSigned(p.error)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function avgBand(points) {
  const widths = points.filter((p) => p.bandLow != null).map((p) => (p.bandHigh - p.bandLow) / 2);
  if (!widths.length) return null;
  return widths.reduce((a, w) => a + w, 0) / widths.length;
}