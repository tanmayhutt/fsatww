import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

export default function AccuracyView({ decisionTime }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .accuracy(decisionTime)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [decisionTime]);

  if (error) return <div className="notice notice-error">{error}</div>;
  if (!data) return <div className="notice">Loading analysis</div>;

  const s = data.dayAhead.summary;
  const horizon = data.byHorizon.filter((h) => h.count >= 30);
  const dayAheadWindow = horizon.filter((h) => h.horizonFrom >= 14 && h.horizonTo <= 38);
  const shortest = horizon[0];
  const byHour = data.dayAhead.byHourOfDay.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00` }));
  const byDay = data.dayAhead.byDay.map((d) => ({ ...d, label: dateLabel(d.deliveryDay).slice(4) }));
  const histogram = data.dayAhead.histogram;

  return (
    <section>
      <div className="headline">
        <h2>How much to trust the day-ahead forecast</h2>
        <p className="muted">
          Every number below uses only the forecast that existed at {decisionTime} GMT the day before delivery,
          across all 31 decision days in January 2026 ({fmtNum(s.count)} delivery hours).
        </p>
      </div>

      <div className="stat-grid">
        <StatTile
          label="Mean absolute error"
          value={fmtMW(s.mae)}
          detail={`${fmtPct(s.nmaePct)} of mean wind output (${fmtMW(s.meanActual)})`}
        />
        <StatTile
          label="Bias"
          value={fmtSigned(s.bias)}
          detail={s.bias > 0 ? "Forecast runs above metered output" : "Forecast runs below metered output"}
          tone={s.bias > 0 ? "over" : "under"}
        />
        <StatTile
          label="1 in 10 hours missed by more than"
          value={fmtMW(s.p90AbsError)}
          detail={`Worst hour: ${fmtMW(s.maxAbsError)}`}
        />
        <StatTile label="Root mean square error" value={fmtMW(s.rmse)} detail="Penalises large misses" />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Error grows with lead time</h3>
          <p className="muted">
            Mean absolute error of every January forecast, grouped by how far ahead it was issued. The shaded
            window is the range a day-ahead decision at {decisionTime} GMT has to live with: about 14 to 38
            hours ahead.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={horizon} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="horizonFrom"
              type="number"
              domain={[0, "dataMax"]}
              tickCount={10}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: COLORS.axis }}
              label={{ value: "Hours between forecast and delivery", position: "insideBottom", offset: -12, fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => `${fmtNum(v)}`}
              label={{ value: "MW", angle: -90, position: "insideLeft", fontSize: 12 }}
            />
            <ReferenceArea x1={14} x2={38} fill={COLORS.band} fillOpacity={0.2} />
            <Tooltip
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
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 16 }} />
            <Line type="monotone" dataKey="mae" name="Mean absolute error" stroke={COLORS.forecast} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="bias" name="Bias (forecast minus actual)" stroke={COLORS.hindsight} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        {shortest && dayAheadWindow.length > 0 && (
          <p className="muted small">
            Forecasts issued under two hours ahead still miss by {fmtMW(shortest.mae)} on average. Across the day-ahead
            window the error is {fmtMW(avg(dayAheadWindow, "mae"))}, so waiting for a fresher forecast would not have
            closed most of the gap.
          </p>
        )}
      </div>

      <div className="two-up">
        <div className="card">
          <div className="card-head">
            <h3>Error by hour of delivery</h3>
            <p className="muted">Mean absolute error of the day-ahead forecast for each hour of the day.</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byHour} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} barCategoryGap={2}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: COLORS.axis }} interval={3} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={56} tickFormatter={fmtNum} />
              <Tooltip
                cursor={{ fill: COLORS.grid, fillOpacity: 0.5 }}
                content={
                  <ChartTooltip
                    title={(d) => `${d.label} GMT`}
                    rows={(d) => [
                      ["Mean absolute error", fmtMW(d.mae), COLORS.bar],
                      ["Bias", fmtSigned(d.bias)],
                      ["Days", fmtNum(d.count)],
                    ]}
                  />
                }
              />
              <Bar dataKey="mae" name="Mean absolute error" fill={COLORS.bar} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Where the errors land</h3>
            <p className="muted">Hourly forecast minus actual, all 740 day-ahead hours. Positive means the forecast was too high.</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histogram} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} barCategoryGap={2}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="from" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: COLORS.axis }} tickFormatter={(v) => fmtNum(v)} interval={1} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine x={0} stroke={COLORS.hindsight} />
              <Tooltip
                cursor={{ fill: COLORS.grid, fillOpacity: 0.5 }}
                content={
                  <ChartTooltip
                    title={(d) => `${fmtSigned(d.from)} to ${fmtSigned(d.to)}`}
                    rows={(d) => [["Hours", fmtNum(d.count), COLORS.bar]]}
                  />
                }
              />
              <Bar dataKey="count" name="Hours" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {histogram.map((b) => (
                  <Cell key={b.from} fill={b.from >= 0 ? COLORS.bar : COLORS.barMuted} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Day by day</h3>
          <p className="muted">Daily wind energy, forecast against metered, for every delivery day bought in January.</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} barCategoryGap={4} barGap={2}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: COLORS.axis }} interval={2} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `${Math.round(v / 1000)} GWh`} />
            <Tooltip
              cursor={{ fill: COLORS.grid, fillOpacity: 0.5 }}
              content={
                <ChartTooltip
                  title={(d) => `Delivery ${dateLabel(d.deliveryDay)}`}
                  rows={(d) => [
                    ["Forecast", fmtMWh(d.forecastMwh), COLORS.forecast],
                    ["Actual", fmtMWh(d.actualMwh), COLORS.actual],
                    ["Mean absolute error", fmtMW(d.mae)],
                    ["Published", dateTimeLabel(d.publishTime)],
                  ]}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="forecastMwh" name="Forecast" fill={COLORS.forecast} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="actualMwh" name="Actual" fill={COLORS.actual} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <details className="details">
          <summary>Daily table</summary>
          <table className="table">
            <thead>
              <tr>
                <th>Delivery day</th>
                <th>Forecast used</th>
                <th className="num">Forecast</th>
                <th className="num">Actual</th>
                <th className="num">MAE</th>
                <th className="num">Bias</th>
                <th className="num">Worst hour</th>
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
        </details>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Error by horizon, table</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Hours ahead</th>
              <th className="num">Forecast hours</th>
              <th className="num">MAE</th>
              <th className="num">Bias</th>
              <th className="num">P90 abs error</th>
              <th className="num">MAE / mean output</th>
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
    </section>
  );
}

function avg(rows, key) {
  return rows.reduce((a, r) => a + r[key], 0) / rows.length;
}
