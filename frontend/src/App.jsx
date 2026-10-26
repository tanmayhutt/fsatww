import { useEffect, useState } from "react";
import { api } from "./api.js";
import Smooth from "./components/Smooth.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import Proof from "./components/Proof.jsx";
import Dither from "./components/Dither.jsx";
import Statement from "./components/Statement.jsx";
import Reveals from "./components/Reveals.jsx";
import Footer from "./components/Footer.jsx";
import DecisionView from "./components/DecisionView.jsx";
import AccuracyView from "./components/AccuracyView.jsx";
import MethodView from "./components/MethodView.jsx";
import { Loading } from "./components/Turbine.jsx";

export default function App() {
  const [meta, setMeta] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    let cancelled = false;
    setAccuracy(null);
    api
      .accuracy(decisionTime)
      .then((d) => !cancelled && setAccuracy(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [decisionTime]);

  // Bumps whenever a section gains content, so reveals bind to new nodes.
  const version = `${meta ? 1 : 0}-${accuracy ? decisionTime : "x"}`;

  return (
    <>
      <a className="skip-link" href="#desk">
        Skip to content
      </a>
      <Nav decisionTime={decisionTime} onDecisionTime={setDecisionTime} />
      <Smooth>
        <div id="page">
          <Hero />
          <Proof summary={accuracy?.dayAhead.summary} decisionTime={decisionTime} />
          <Dither height={300} cell={4} source="streaks" className="seam" />

          <main>
            {error && (
              <div className="container">
                <div className="notice notice-error">Could not reach the analysis API: {error}. Start the backend and reload.</div>
              </div>
            )}

            <section className="band" id="desk" aria-labelledby="desk-title">
              <div className="container">
                {meta ? <DecisionView meta={meta} decisionTime={decisionTime} /> : !error && <Loading label="reading the wind" />}
              </div>
            </section>

            <Statement />

            <section className="band" id="accuracy" aria-labelledby="accuracy-title">
              <div className="container">
                {accuracy ? <AccuracyView data={accuracy} decisionTime={decisionTime} /> : !error && <Loading label="scoring every forecast" />}
              </div>
            </section>

            <section className="band band-ink" id="method" aria-labelledby="method-title">
              <div className="container">{meta && <MethodView meta={meta} />}</div>
            </section>
          </main>

          <Footer meta={meta} />
        </div>
      </Smooth>
      <Reveals version={version} />
    </>
  );
}
