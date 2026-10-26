import { useEffect } from "react";
import { ScrollTrigger, SplitText, gsap, reducedMotion, useGsap } from "../motion.js";
import { useSmoothReady } from "./Smooth.jsx";

// Scroll-in choreography for the page body: section headings rise line by
// line out of a mask, and figures, panels and tables fade up once.
export default function Reveals({ version }) {
  const ready = useSmoothReady();

  useGsap(() => {
    if (!ready || reducedMotion()) return;
    const root = document.getElementById("page");
    if (!root) return;
    root.querySelectorAll(".section-head .h2").forEach((el) => {
      if (el.dataset.split) return;
      el.dataset.split = "1";
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 1,
            stagger: 0.09,
            ease: "power4.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          }),
      });
    });
    root.querySelectorAll("[data-reveal]").forEach((el) => {
      if (el.dataset.revealed) return;
      el.dataset.revealed = "1";
      gsap.from(el, {
        y: 28,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
  }, [ready, version]);

  // Data arriving changes section heights; let ScrollTrigger re-measure.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [version]);

  return null;
}
