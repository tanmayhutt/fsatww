import { useEffect, useRef } from "react";
import { gsap, reducedMotion } from "../motion.js";
import { dateTimeLabel, fmtMWh } from "../format.js";

// The 48 hours leading up to a delivery day, drawn as a single line. Every
// forecast issue is a tick; the one the desk used is filled; gate closure is
// the marker everything to its right is blind to. Makes the vintage rule
// visible before the table spells it out.
export default function VintageTimeline({ history, decisionAt, publishTime, deliveryDay }) {
  const ref = useRef(null);

  const end = new Date(`${deliveryDay}T00:00:00Z`).getTime();
  const start = end - 48 * 3600 * 1000;
  const span = end - start;
  const pos = (iso) => Math.min(1, Math.max(0, (new Date(iso).getTime() - start) / span));
  const gate = pos(decisionAt);
  const width = 1000;
  const x = (p) => 24 + p * (width - 48);

  // Plays once when the strip enters the viewport. An IntersectionObserver
  // rather than a ScrollTrigger, because this element appears after a fetch
  // and its position is not known when the page's triggers are measured.
  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current;
    const ctx = gsap.context(() => {
      gsap.set(".vt-line", { scaleX: 0, transformOrigin: "left center" });
      gsap.set(".vt-tick", { scaleY: 0, transformOrigin: "center bottom" });
      gsap.set(".vt-gate", { scaleY: 0, transformOrigin: "center top" });
      gsap.set(".vt-blind", { opacity: 0 });
    }, el);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        ctx.add(() => {
          gsap
            .timeline()
            .to(".vt-line", { scaleX: 1, duration: 0.9, ease: "power3.inOut" })
            .to(".vt-tick", { scaleY: 1, duration: 0.4, stagger: 0.05, ease: "back.out(2)" }, "-=0.4")
            .to(".vt-gate", { scaleY: 1, duration: 0.5, ease: "power3.out" }, "-=0.2")
            .to(".vt-blind", { opacity: 1, duration: 0.6 }, "-=0.3");
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, [deliveryDay, publishTime]);

  return (
    <div className="vt" ref={ref}>
      <svg viewBox={`0 0 ${width} 120`} className="vt-svg" role="img" aria-label="Forecast issues on a 48 hour timeline before delivery, with gate closure marked">
        <rect className="vt-blind" x={x(gate)} y={30} width={x(1) - x(gate)} height={60} rx={4} />
        <line className="vt-line" x1={x(0)} y1={70} x2={x(1)} y2={70} />
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <text key={p} className="vt-axis" x={x(p)} y={100} textAnchor={p === 0 ? "start" : p === 1 ? "end" : "middle"}>
            {p === 1 ? "delivery 00:00" : `${Math.round(48 - p * 48)} h before`}
          </text>
        ))}
        {history.map((h) => {
          const used = h.publishTime === publishTime;
          const px = x(pos(h.publishTime));
          return (
            <g key={h.publishTime} className={`vt-tick${used ? " vt-tick-used" : ""}`}>
              <line x1={px} y1={used ? 48 : 58} x2={px} y2={70} />
              <circle cx={px} cy={used ? 44 : 55} r={used ? 6 : 3.5} />
              <title>
                {dateTimeLabel(h.publishTime)}, {fmtMWh(h.points.reduce((a, p) => a + p.forecast, 0))} for the day
              </title>
            </g>
          );
        })}
        <g className="vt-gate">
          <line x1={x(gate)} y1={18} x2={x(gate)} y2={92} />
          <text x={x(gate)} y={12} textAnchor="middle">
            gate closure
          </text>
        </g>
      </svg>
      <div className="vt-legend">
        <span>
          <i className="vt-key vt-key-used" /> used for the decision
        </span>
        <span>
          <i className="vt-key" /> earlier issue
        </span>
        <span>
          <i className="vt-key vt-key-blind" /> published after the decision, never shown
        </span>
      </div>
    </div>
  );
}
