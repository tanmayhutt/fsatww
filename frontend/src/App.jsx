import { useEffect, useState } from "react";
import { api } from "./api.js";
import DecisionView from "./components/DecisionView.jsx";
import AccuracyView from "./components/AccuracyView.jsx";
import MethodView from "./components/MethodView.jsx";
import { Loading, Turbine } from "./components/Turbine.jsx";

const TABS = [
  { id: "decision", label: "Day-ahead desk" },
  { id: "accuracy", label: "Forecast accuracy" },
  { id: "method", label: "Method" },
];

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("decision");
  const [decisionTime, setDecisionTime] = useState("09:50");

  useEffect(() => {
    api
      .meta()
      .then((m) => {
        setMeta(m);
        setDecisionTime(m.defaultDecisionTime);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="nav" aria-label="Views">
        <a className="nav-brand" href="/" onClick={(e) => { e.preventDefault(); setTab("decision"); }}>
          <Turbine size={26} title="Wind Forecast Desk" />
          <span className="nav-wordmark">Wind Forecast Desk</span>
        </a>
        <div className="nav-links">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="nav-gate">
          <span className="nav-gate-hint">gate closure, GMT</span>
          <input
            type="time"
            value={decisionTime}
            step={300}
            onChange={(e) => e.target.value && setDecisionTime(e.target.value)}
            aria-label="Day-ahead decision time, GMT"
          />
        </label>
      </nav>

      <main id="main" className="main">
        {error && (
          <div className="notice notice-error">
            Could not reach the analysis API: {error}. Start the backend and reload.
          </div>
        )}
        {!meta && !error && <Loading label="reading the wind" />}
        {meta && tab === "decision" && <DecisionView meta={meta} decisionTime={decisionTime} />}
        {meta && tab === "accuracy" && <AccuracyView decisionTime={decisionTime} />}
        {meta && tab === "method" && <MethodView meta={meta} />}
      </main>

      <footer className="footer">
        <span>source: elexon bmrs, datasets windfor and fuelhh, national level, fuel type wind</span>
        <span>january 2026, all times gmt</span>
      </footer>
    </div>
  );
}
