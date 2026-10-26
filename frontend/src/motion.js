import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

export { gsap, ScrollTrigger, ScrollSmoother, SplitText };

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs `fn` inside a gsap.context scoped to `ref`, so every tween and
// ScrollTrigger it creates is reverted when the component unmounts or `deps`
// change. Mirrors @gsap/react's useGSAP without the extra dependency.
export function useGsap(fn, deps = [], scopeRef) {
  useLayoutEffect(() => {
    const ctx = gsap.context(fn, scopeRef?.current || undefined);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
