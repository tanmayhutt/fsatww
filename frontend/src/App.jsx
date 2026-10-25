import { useEffect, useState } from "react";
import { api } from "./api.js";
import DecisionView from "./components/DecisionView.jsx";
import AccuracyView from "./components/AccuracyView.jsx";
import MethodView from "./components/MethodView.jsx";

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
      <header className="header">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <path d="M14 26V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 12 4.5 7.5M14 12l9.5-4.5M14 12v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <div className="brand-name">Wind Forecast Desk</div>
            <div className="brand-sub">GB day-ahead wind, January 2026, Elexon data</div>
          </div>
        </div>
        <label className="field field-inline">
          <span>Gate closure</span>
          <input
            type="time"
            value={decisionTime}
            step={300}
            onChange={(e) => e.target.value && setDecisionTime(e.target.value)}
            aria-label="Day-ahead decision time, GMT"
          />
          <span className="muted small">GMT, day before delivery</span>
        </label>
      </header>

      <nav className="tabs" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? " tab-active" : ""}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main id="main" className="main">
        {error && (
          <div className="notice notice-error">
            Could not reach the analysis API: {error}. Start the backend and reload.
          </div>
        )}
        {!meta && !error && <div className="notice">Loading</div>}
        {meta && tab === "decision" && <DecisionView meta={meta} decisionTime={decisionTime} />}
        {meta && tab === "accuracy" && <AccuracyView decisionTime={decisionTime} />}
        {meta && tab === "method" && <MethodView meta={meta} />}
      </main>

      <footer className="footer muted small">
        Source: Elexon BMRS datasets WINDFOR and FUELHH, national level, fuel type WIND. Times are GMT.
      </footer>
    </div>
  );
}
