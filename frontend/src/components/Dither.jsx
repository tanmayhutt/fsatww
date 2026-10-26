import { useEffect, useRef } from "react";
import { gsap, reducedMotion } from "../motion.js";

// Ordered (Bayer 8x8) dither of a procedural luminance field, with a wavy
// boundary below which the pattern dissolves into the solid `to` colour.
// Used as the seam between the ink hero and the bone page, and as the static
// texture behind the statement band.
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function hash(x, y, s) {
  let r = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  r = (r ^ (r >>> 13)) * 1274126177;
  return ((r ^ (r >>> 16)) >>> 0) / 4294967295;
}

// Luminance sources. Each returns 0..1 for a cell (u, v in 0..1) at time t.
export const SOURCES = {
  streaks: (u, v, t) =>
    0.5 +
    0.5 *
      Math.sin(u * 14 + Math.sin(v * 9 + t * 0.4) * 2.2 + t * 0.6) *
      (0.35 + 0.65 * Math.sin(v * 3.1 + u * 1.3 + t * 0.2) ** 2),
  radial: (u, v) => {
    const dx = (u - 0.5) * 1.6;
    const dy = v - 0.5;
    return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.5);
  },
};

export default function Dither({
  height = 420,
  cell = 4,
  from = "#171713",
  to = "#f4f1e8",
  source = "streaks",
  wave = true,
  animate = true,
  className = "",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const host = ref.current;
    const canvas = host.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const lum = typeof source === "function" ? source : SOURCES[source];
    let cols = 0;
    let rows = 0;
    let phase = 0;

    const boundary = (c) => {
      if (!wave) return rows + 1;
      const u = c / cols;
      return rows * (0.4 + 0.05 * Math.sin(u * 7.3 + phase * 0.3) + 0.035 * Math.sin(u * 19.1 - phase * 0.2) + 0.02 * Math.sin(u * 37.7 + phase * 0.45));
    };

    const paint = () => {
      ctx.fillStyle = from;
      ctx.fillRect(0, 0, cols * cell, rows * cell);
      ctx.fillStyle = to;
      for (let c = 0; c < cols; c++) {
        const b = boundary(c);
        for (let r = 0; r < rows; r++) {
          const below = r - b;
          if (below < -rows * 0.1 && wave) continue;
          const lit = lum(c / cols, r / rows, phase) > (BAYER[r & 7][c & 7] + 0.5) / 64;
          if (!wave) {
            if (lit) ctx.fillRect(c * cell, r * cell, cell, cell);
          } else if (below < 0) {
            if (lit && hash(c, r, 5) < 0.35 * Math.exp(below / (rows * 0.04))) ctx.fillRect(c * cell, r * cell, cell, cell);
          } else if (!(!lit && hash(c, r, 5) > 1 - Math.exp(-below / (rows * 0.12)))) {
            ctx.fillRect(c * cell, r * cell, cell, cell);
          }
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = host.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / cell);
      rows = Math.ceil(height / cell);
      paint();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    if (!animate || reducedMotion()) return () => ro.disconnect();

    let last = 0;
    const tick = (time) => {
      if (time - last < 1 / 12) return;
      last = time;
      phase += 0.1;
      paint();
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
    };
  }, [height, cell, from, to, source, wave, animate]);

  return (
    <div className={`dither ${className}`} ref={ref} aria-hidden="true" style={{ height }}>
      <canvas />
    </div>
  );
}
