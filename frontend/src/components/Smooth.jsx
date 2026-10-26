import { createContext, useContext, useRef, useState } from "react";
import { ScrollSmoother, ScrollTrigger, reducedMotion, useGsap } from "../motion.js";

const SmoothContext = createContext(false);
export const useSmoothReady = () => useContext(SmoothContext);

// Wraps the page in ScrollSmoother so scroll-driven animation is eased. Skipped
// entirely under prefers-reduced-motion, where the page scrolls natively.
export default function Smooth({ children }) {
  const wrapper = useRef(null);
  const [ready, setReady] = useState(false);

  useGsap(() => {
    if (!reducedMotion()) {
      ScrollSmoother.create({
        wrapper: wrapper.current,
        content: wrapper.current.firstElementChild,
        smooth: 1.1,
        effects: true,
        smoothTouch: false,
      });
    }
    setReady(true);
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    return () => window.removeEventListener("load", refresh);
  }, []);

  return (
    <SmoothContext.Provider value={ready}>
      <div id="smooth-wrapper" ref={wrapper}>
        <div id="smooth-content">{children}</div>
      </div>
    </SmoothContext.Provider>
  );
}

export function scrollToSection(target, offset = "top 64px") {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return;
  const smoother = ScrollSmoother.get();
  if (smoother) smoother.scrollTo(el, true, offset);
  else el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
}
