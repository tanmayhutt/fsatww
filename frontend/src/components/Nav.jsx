import { useRef, useState } from "react";
import { ScrollTrigger, useGsap } from "../motion.js";
import { scrollToSection } from "./Smooth.jsx";
import { Turbine } from "./Turbine.jsx";

const LINKS = [
  { href: "#desk", label: "Desk" },
  { href: "#accuracy", label: "Accuracy" },
  { href: "#method", label: "Method" },
];

export default function Nav({ decisionTime, onDecisionTime }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useGsap(() => {
    const el = ref.current;
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => el.classList.toggle("is-solid", self.scroll() > 40),
    });
  }, []);

  const go = (e, href) => {
    e.preventDefault();
    setOpen(false);
    scrollToSection(href);
  };

  return (
    <>
      <header className={`nav${open ? " is-solid" : ""}`} ref={ref}>
        <div className="container nav-inner">
          <a className="nav-brand" href="#top" onClick={(e) => go(e, "#top")} aria-label="Wind Forecast Desk, top">
            <Turbine size={24} />
            <span className="nav-wordmark">Wind Forecast Desk</span>
          </a>
          <nav className="nav-links" aria-label="Sections">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
                {l.label}
              </a>
            ))}
          </nav>
          <label className="nav-gate">
            <span className="nav-gate-hint">gate closure, gmt</span>
            <input
              type="time"
              value={decisionTime}
              step={300}
              onChange={(e) => e.target.value && onDecisionTime(e.target.value)}
              aria-label="Day-ahead decision time, GMT"
            />
          </label>
          <button className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span />
          </button>
        </div>
      </header>
      <div className="nav-menu" data-open={open}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
            {l.label}
          </a>
        ))}
        <label className="nav-menu-gate">
          <span>gate closure, gmt</span>
          <input
            type="time"
            value={decisionTime}
            step={300}
            onChange={(e) => e.target.value && onDecisionTime(e.target.value)}
            aria-label="Day-ahead decision time, GMT"
          />
        </label>
      </div>
    </>
  );
}
