export default function MethodView({ meta }) {
  return (
    <section className="prose">
      <p className="kicker">method</p>
      <h1 className="h1">How the numbers are made.</h1>

      <h3>Data</h3>
      <p>
        Two Elexon BMRS datasets and nothing else. <strong>WINDFOR</strong> gives the national wind generation
        forecast: for each target hour (<code>startTime</code>) there are many rows, one per issue time
        (<code>publishTime</code>). <strong>FUELHH</strong> gives metered generation per half hour; rows with
        <code>fuelType = WIND</code> are the outcome. The two half hours inside each forecast hour are averaged so
        both series describe the same interval. The snapshot holds {meta.forecastRows.toLocaleString("en-GB")}{" "}
        forecast rows and {meta.actualHours.toLocaleString("en-GB")} metered hours.
      </p>

      <h3>The decision moment</h3>
      <p>
        The GB day-ahead auction on N2EX closes at 09:50 UK time the day before delivery. In January the UK is
        on GMT, so clock time equals UTC. For every decision day in January 2026 the app finds the newest
        WINDFOR issue whose <code>publishTime</code> is on or before 09:50 and treats that as the forecast the
        desk had. Issues published later that day did not exist yet, so they are never used for a decision.
        The decision time can be changed in the header to test other cut-offs.
      </p>

      <h3>Why not compare against the newest forecast</h3>
      <p>
        Elexon reissues each forecast at {meta.publishTimesOfDay.join(", ")} every day, and each reissue is
        closer to delivery and usually better. Scoring the forecast that was published two hours before
        delivery would describe information the buyer never had, and it would flatter the forecast. Every
        headline number in this app is computed on the vintage that existed at gate closure. Error is then also
        grouped by horizon, the gap between <code>publishTime</code> and <code>startTime</code>, so the cost of
        deciding early is visible.
      </p>

      <h3>Metrics</h3>
      <ul>
        <li>
          <strong>Error</strong> is forecast minus actual, in MW, per delivery hour. Positive means the forecast
          was too high and the desk would have bought too little.
        </li>
        <li>
          <strong>Mean absolute error</strong> is the typical size of a miss regardless of direction.
        </li>
        <li>
          <strong>Bias</strong> is the mean signed error. A persistent bias can be corrected before buying.
        </li>
        <li>
          <strong>P90 absolute error</strong> is the miss exceeded in one hour out of ten. It sizes the reserve a
          risk-averse buyer might hold.
        </li>
        <li>
          <strong>Expected range</strong> on the day-ahead chart is the forecast minus the 10th and 90th percentile
          of signed error for that horizon bucket, learned from all January day-ahead decisions.
        </li>
        <li>
          <strong>MAE / mean output</strong> normalises error by the month's mean metered wind so it can be compared
          with other months or sources.
        </li>
      </ul>

      <h3>Limits</h3>
      <ul>
        <li>One month of data. The expected range is indicative, not a calibrated forecast interval.</li>
        <li>
          WINDFOR forecasts available wind. Metered FUELHH output is lower when wind farms are curtailed, which
          is a likely contributor to the positive bias. The data cannot separate the two causes.
        </li>
        <li>
          Decisions in January 2026 buy delivery days 2 January to 1 February. Delivery on 1 January was bought in
          December and is excluded.
        </li>
      </ul>
    </section>
  );
}
