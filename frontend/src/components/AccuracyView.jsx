import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { COLORS } from "../theme.js";
import { dateLabel, dateTimeLabel, fmtMW, fmtMWh, fmtNum, fmtPct, fmtSigned } from "../format.js";
import StatTile from "./StatTile.jsx";
import ChartTooltip from "./ChartTooltip.jsx";
import { Loading } from "./Turbine.jsx";

const tick = { fontSize: 12, fill: COLORS.tick, fontFamily: "var(--mono)" };
const tickSmall = { ...tick, fontSize: 11 };
const cursorFill = { fill: COLORS.grid };

export default function AccuracyView({ decisionTime }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    api
      .accuracy(decisionTime)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [decisionTime]);

  if (error) return <div className="notice notice-error">{error}</div>;
  if (!data) return <Loading label="scoring every forecast" />;

  const s = data.dayAhead.summary;
  const horizon = data.byHorizon.filter((h) => h.count >= 30);
  const dayAheadWindow = horizon.filter((h) => h.horizonFrom >= 14 && h.horizonTo <= 38);
  const shortest = horizon[0];
  const byHour = data.dayAhead.byHourOfDay.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` }));
  const byDay = data.dayAhead.byDay.map((d) => ({ ...d, label: dateLabel(d.deliveryDay).slice(4) }));
  const histogram = data.dayAhead.histogram;
  const worstHour = byHour.reduce((a, b) => (b.mae > a.mae ? b : a), byHour[0]);

  return (
    <section>
      <div className="section-head">
        <div>
          <p className="kicker">forecast accuracy, january 2026</p>
          <h1 className="h1">How much to trust the day-ahead forecast.</h1>
        </div>
        <p className="lead">
          Every number uses only the forecast that existed at {decisionTime} GMT the day before delivery, across
          all 31 decision days in January 2026, {fmtNum(s.count)} delivery hours.
        </p>
      </div>

      <dl className="metrics metrics-bone">
        <StatTile
          label="mean absolute error"
          value={fmtMW(s.mae)}
          detail={`${fmtPct(s.nmaePct)} of mean wind output, ${fmtMW(s.meanActual)}`}
        />
        <StatTile
          label="bias, forecast minus actual"
          value={fmtSigned(s.bias)}
          detail={s.bias > 0 ? "Forecast runs above metered output" : "Forecast runs below metered output"}
          tone={s.bias > 0 ? "over" : "under"}
        />
        <StatTile label="1 in 10 hours missed by over" value={fmtMW(s.p90AbsError)} detail={`Worst hour: ${fmtMW(s.maxAbsError)}`} />
        <StatTile label="root mean square error" value={fmtMW(s.rmse)} detail="Penalises large misses" />
      </dl>

      <div className="figure">
        <div className="figure-head">
          <h3 className="h3">Error grows with lead time</h3>
          <p className="lead">
            Mean absolute error of every January forecast, grouped by how far ahead it was issued. The shaded window,
            14 to 38 hours, is what a decision at {decisionTime} GMT has to live with.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={horizon} margin={{ top: 8, right: 8, bottom: 22, left: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="horizonFrom"
              type="number"
              domain={[0, "dataMax"]}
              tickCount={10}
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: COLORS.axis }}
              label={{ value: "hours between forecast and delivery", position: "insideBottom", offset: -12, fontSize: 12, fill: COLORS.tick, fontFamily: "var(--mono)" }}
            />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={52} tickFormatter={fmtNum} />
            <ReferenceArea x1={14} x2={38} fill={COLORS.band} fillOpacity={0.35} />
            <Tooltip
              cursor={{ stroke: COLORS.axis }}
              content={
                <ChartTooltip
                  title={(d) => `${d.horizonFrom} to ${d.horizonTo} hours ahead`}
                  rows={(d) => [
                    ["Mean absolute error", fmtMW(d.mae), COLORS.forecast],
                    ["Bias", fmtSigned(d.bias), COLORS.hindsight],
                    ["Forecast hours", fmtNum(d.count)],
                  ]}
                />
              }
            />
            <Line type="monotone" dataKey="mae" stroke={COLORS.forecast} strokeWidth={2.25} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#f4f2ee" }} isAnimationActive={false} />
            <Line type="monotone" dataKey="bias" stroke={COLORS.hindsight} strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: COLORS.forecast }} />
            mean absolute error
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch-dashed" style={{ color: COLORS.hindsight }} />
            bias, forecast minus actual
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch-area" style={{ background: COLORS.band }} />
            day-ahead window
          </span>
        </div>
        {shortest && dayAheadWindow.length > 0 && (
          <p className="insight">
            Forecasts issued under two hours ahead still miss by <strong>{fmtMW(shortest.mae)}</strong> on average.
            Across the day-ahead window the miss is <strong>{fmtMW(avg(dayAheadWindow, "mae"))}</strong>, so waiting
            for a fresher forecast would not have closed most of the gap. The bias is the bigger lever.
          </p>
        )}
      </div>

      <div className="two-up">
        <div className="figure">
          <div className="figure-head">
            <h3 className="h3">Error by hour of delivery</h3>
            <p className="lead">Mean absolute error of the day-ahead forecast, per hour of the day.</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byHour} margin={{ top: 8, right: 4, bottom: 4, left: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tick={tickSmall} tickLine={false} axisLine={{ stroke: COLORS.axis }} interval="preserveStartEnd" minTickGap={28} />
              <YAxis tick={tick} tickLine={false} axisLine={false} width={46} tickFormatter={fmtNum} />
              <Tooltip
                cursor={cursorFill}
                content={
                  <ChartTooltip
                    title={(d) => `${d.label} gmt`}
                    rows={(d) => [
                      ["Mean absolute error", fmtMW(d.mae), COLORS.bar],
                      ["Bias", fmtSigned(d.bias)],
                      ["Days", fmtNum(d.count)],
                    ]}
                  />
                }
              />
              <Bar dataKey="mae" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {byHour.map((h) => (
                  <Cell key={h.hour} fill={h.hour === worstHour.hour ? COLORS.actual : COLORS.bar} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="insight">
            Hardest hour to forecast: <strong>{worstHour.label} GMT</strong>, {fmtMW(worstHour.mae)} average miss.
          </p>
        </div>

        <div className="figure">
          <div className="figure-head">
            <h3 className="h3">Where the errors land</h3>
            <p className="lead">
              Hourly forecast minus actual, all {fmtNum(s.count)} day-ahead hours. Right of zero means the forecast was
              too high.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histogram} margin={{ top: 8, right: 4, bottom: 4, left: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="from" tick={tickSmall} tickLine={false} axisLine={{ stroke: COLORS.axis }} tickFormatter={(v) => fmtNum(v)} interval="preserveStartEnd" minTickGap={30} />
              <YAxis tick={tick} tickLine={false} axisLine={false} width={34} />
              <ReferenceLine x={0} stroke={COLORS.hindsight} />
              <Tooltip
                cursor={cursorFill}
                content={
                  <ChartTooltip
                    title={(d) => `${fmtSigned(d.from)} to ${fmtSigned(d.to)}`}
                    rows={(d) => [["Hours", fmtNum(d.count), d.from >= 0 ? COLORS.bar : COLORS.barMuted]]}
                  />
                }
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {histogram.map((b) => (
                  <Cell key={b.from} fill={b.from >= 0 ? COLORS.bar : COLORS.barMuted} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-bar" style={{ background: COLORS.bar }} />
              forecast too high
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-swatch-bar" style={{ background: COLORS.barMuted }} />
              forecast too low
            </span>
          </div>
        </div>
      </div>

      <div className="figure">
        <div className="figure-head">
          <h3 className="h3">Day by day</h3>
          <p className="lead">Daily wind energy, forecast against metered, for every delivery day bought in January.</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byDay} margin={{ top: 8, right: 4, bottom: 4, left: 0 }} barCategoryGap={4} barGap={2}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={tickSmall} tickLine={false} axisLine={{ stroke: COLORS.axis }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)} GWh`} />
            <Tooltip
              cursor={cursorFill}
              content={
                <ChartTooltip
                  title={(d) => `delivery ${dateLabel(d.deliveryDay).toLowerCase()}`}
                  rows={(d) => [
                    ["Forecast", fmtMWh(d.forecastMwh), COLORS.forecast],
                    ["Actual", fmtMWh(d.actualMwh), COLORS.actual],
                    ["Mean absolute error", fmtMW(d.mae)],
                    ["Published", dateTimeLabel(d.publishTime)],
                  ]}
                />
              }
            />
            <Bar dataKey="forecastMwh" fill={COLORS.forecast} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="actualMwh" fill={COLORS.actual} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch legend-swatch-bar" style={{ background: COLORS.forecast }} />
            forecast
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-swatch-bar" style={{ background: COLORS.actual }} />
            actual
          </span>
        </div>
        <details className="details" style={{ marginTop: 18 }}>
          <summary>daily table</summary>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>delivery day</th>
                  <th>forecast used</th>
                  <th className="num">forecast</th>
                  <th className="num">actual</th>
                  <th className="num">mae</th>
                  <th className="num">bias</th>
                  <th className="num">worst hour</th>
                </tr>
              </thead>
              <tbody>
                {data.dayAhead.byDay.map((d) => (
                  <tr key={d.deliveryDay}>
                    <td>{dateLabel(d.deliveryDay)}</td>
                    <td>{dateTimeLabel(d.publishTime)}</td>
                    <td className="num">{fmtMWh(d.forecastMwh)}</td>
                    <td className="num">{fmtMWh(d.actualMwh)}</td>
                    <td className="num">{fmtMW(d.mae)}</td>
                    <td className="num">{fmtSigned(d.bias)}</td>
                    <td className="num">{fmtMW(d.maxAbsError)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <details className="details">
        <summary>error by lead time, full table</summary>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>hours ahead</th>
                <th className="num">forecast hours</th>
                <th className="num">mae</th>
                <th className="num">bias</th>
                <th className="num">p90 abs error</th>
                <th className="num">mae / mean output</th>
              </tr>
            </thead>
            <tbody>
              {horizon.map((h) => (
                <tr key={h.horizonFrom} className={h.horizonFrom >= 14 && h.horizonTo <= 38 ? "row-used" : ""}>
                  <td>
                    {h.horizonFrom} to {h.horizonTo}
                  </td>
                  <td className="num">{fmtNum(h.count)}</td>
                  <td className="num">{fmtMW(h.mae)}</td>
                  <td className="num">{fmtSigned(h.bias)}</td>
                  <td className="num">{fmtMW(h.p90AbsError)}</td>
                  <td className="num">{fmtPct(h.nmaePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function avg(rows, key) {
  return rows.reduce((a, r) => a + r[key], 0) / rows.length;
}
