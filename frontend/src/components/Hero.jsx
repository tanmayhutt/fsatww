import { useRef } from "react";
import { ScrollTrigger, gsap, reducedMotion, useGsap } from "../motion.js";
import { useSmoothReady, scrollToSection } from "./Smooth.jsx";
import WindField from "./WindField.jsx";
import Arrow from "./Arrow.jsx";

const TITLE = ["The wind forecast", "you had when", "you had to buy."];

export default function Hero() {
  const ref = useRef(null);
  const state = useRef({ scroll: 0 });
  const ready = useSmoothReady();

  // Pin the hero while the page scrolls over it, and darken it as it goes.
  useGsap(
    () => {
      if (!ready || reducedMotion()) return;
      const el = ref.current;
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom top",
        pin: true,
        pinSpacing: false,
        onUpdate: (self) => {
          state.current.scroll = self.progress;
        },
      });
      gsap.to(".hero-cover", {
        opacity: 0.6,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
    },
    [ready],
    ref
  );

  // Entrance: lines rise out of their masks, then the lead and buttons.
  useGsap(
    () => {
      if (reducedMotion()) return;
      gsap.set(".hero-line > span", { yPercent: 110 });
      gsap.set(".hero-sub > *", { opacity: 0, y: 18 });
      gsap
        .timeline()
        .to(".hero-line > span", { yPercent: 0, duration: 1.1, stagger: 0.1, ease: "power4.out" }, 0.5)
        .to(".hero-sub > *", { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 1.0);
    },
    [],
    ref
  );

  return (
    <section className="hero" ref={ref} id="top">
      <div className="hero-media" aria-hidden="true">
        <WindField state={state} />
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-cover" aria-hidden="true" />
      <div className="container hero-grid">
        <h1 className="h1">
          {TITLE.map((line) => (
            <span className="hero-line" key={line}>
              <span>{line}</span>
            </span>
          ))}
        </h1>
        <div className="hero-sub">
          <p className="lead">
            Great Britain wind generation for the day-ahead buyer. The forecast that existed at gate closure, and
            how far to trust it, from Elexon data for January 2026.
          </p>
          <div className="actions">
            <a className="btn btn-bone" href="#desk" onClick={(e) => { e.preventDefault(); scrollToSection("#desk"); }}>
              Open the desk <Arrow />
            </a>
            <a className="btn btn-line" href="#accuracy" onClick={(e) => { e.preventDefault(); scrollToSection("#accuracy"); }}>
              See the accuracy
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
