import { useRef } from "react";
import { gsap, reducedMotion, useGsap } from "../motion.js";
import { useSmoothReady } from "./Smooth.jsx";
import { fmtNum } from "../format.js";

// Four headline numbers from the accuracy run, counted up as they scroll in.
export default function Proof({ summary, decisionTime }) {
  const ref = useRef(null);
  const ready = useSmoothReady();

  const items = summary
    ? [
        { value: summary.mae, unit: " MW", label: "Average miss per hour, for the forecast the desk actually had." },
        { value: summary.bias, unit: " MW", signed: true, label: "Bias. The forecast runs above metered output at every lead time." },
        { value: summary.p90AbsError, unit: " MW", label: "One hour in ten missed by more than this." },
        { value: summary.count, unit: "", label: `Delivery hours scored, every decision at ${decisionTime} GMT in January.` },
      ]
    : [];

  useGsap(
    () => {
      if (!ready || reducedMotion() || !summary) return;
      const el = ref.current;
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 75%", once: true } });
      tl.from(".proof-value > span", { yPercent: 110, duration: 1, stagger: 0.1, ease: "power4.out" }, 0);
      el.querySelectorAll(".proof-count").forEach((node, i) => {
        const target = Number(node.dataset.count);
        const unit = node.dataset.unit || "";
        const signed = node.dataset.signed === "1";
        const o = { v: 0 };
        tl.to(
          o,
          {
            v: target,
            duration: 1.4,
            ease: "power2.out",
            onUpdate: () => {
              const n = Math.round(o.v);
              node.textContent = `${signed && n > 0 ? "+" : ""}${fmtNum(n)}${unit}`;
            },
          },
          0.2 + i * 0.1
        );
      });
    },
    [ready, summary],
    ref
  );

  return (
    <section className="band band-ink proof-section" ref={ref} aria-label="Headline accuracy">
      <div className="container">
        <p className="kicker">january 2026, day-ahead forecasts scored against metered wind</p>
        <div className="proof">
          {items.map((it) => (
            <div className="proof-item" key={it.label}>
              <div className="proof-value">
                <span>
                  <span className="proof-count" data-count={it.value} data-unit={it.unit} data-signed={it.signed ? "1" : "0"}>
                    {it.signed && it.value > 0 ? "+" : ""}
                    {fmtNum(it.value)}
                    {it.unit}
                  </span>
                </span>
              </div>
              <p className="proof-label">{it.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
