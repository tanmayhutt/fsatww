import { useRef } from "react";
import { gsap, reducedMotion, useGsap } from "../motion.js";
import { useSmoothReady } from "./Smooth.jsx";
import Dither from "./Dither.jsx";

export default function Statement() {
  const ref = useRef(null);
  const ready = useSmoothReady();

  useGsap(
    () => {
      if (!ready || reducedMotion()) return;
      gsap.fromTo(
        ".statement-bg",
        { yPercent: -6 },
        { yPercent: 6, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } }
      );
      gsap.from(".statement-copy", { y: 28, opacity: 0, duration: 1.1, scrollTrigger: { trigger: ref.current, start: "top 75%", once: true } });
    },
    [ready],
    ref
  );

  return (
    <section className="statement" ref={ref} aria-label="Statement">
      <div className="statement-bg" aria-hidden="true">
        <Dither height={900} cell={5} from="#ecd9bc" to="#1e1d1b" source="radial" wave={false} animate={false} />
      </div>
      <div className="statement-fade" aria-hidden="true" />
      <p className="kicker">the rule behind every number</p>
      <p className="statement-copy">A forecast only counts if it existed before you had to decide.</p>
    </section>
  );
}
