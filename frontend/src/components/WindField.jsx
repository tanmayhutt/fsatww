import { useEffect, useRef } from "react";
import { reducedMotion } from "../motion.js";

// A field of particles carried by the wind, drawn at half resolution and
// scaled up so it reads as coarse pixels, with a row of turbines whose rotors
// turn with it. Trails come from painting a translucent ink layer each frame
// instead of clearing.
//
// When `wind` (hourly metered MW for January) is supplied, the wind strength
// replays the real month: one hour of data every `hourMs`. `onTick` receives
// the current index so the hero can caption it. `state.current.scroll` lets
// the hero calm the field as it pins.
const INK = "#171713";
const CREAM = "#f4f1e8";
const LIME = "#d8ff6b";

export default function WindField({ state, wind, hourMs = 900, onTick, className = "" }) {
  const ref = useRef(null);
  const windRef = useRef(wind);
  const tickRef = useRef(onTick);
  windRef.current = wind;
  tickRef.current = onTick;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const scale = 0.5;
    let width = 0;
    let height = 0;
    let particles = [];
    let raf = 0;
    let t = 0;
    let spin = 0;
    let hourIndex = 0;
    let hourStart = performance.now();
    let strength = 0.75;
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0 };
    let lastPointer = null;
    let reach2 = 0;

    const field = (x, y, time) => {
      const nx = x / width;
      const ny = y / height;
      const a =
        Math.sin(ny * 6.3 + time * 0.25) * 0.55 +
        Math.sin(nx * 4.1 - time * 0.18 + ny * 3.2) * 0.35 +
        Math.sin((nx + ny) * 9.7 + time * 0.12) * 0.15;
      return { x: 1.15 + Math.cos(a) * 0.55, y: Math.sin(a) * 0.45 };
    };

    const spawn = (p) => {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
      p.life = 120 + Math.random() * 240;
      p.speed = 0.6 + Math.random() * 1.1;
      p.size = Math.random() < 0.12 ? 2 : 1;
      return p;
    };

    const resize = () => {
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      width = Math.max(1, Math.round(w * scale));
      height = Math.max(1, Math.round(h * scale));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      reach2 = (Math.max(width, height) * 0.11) ** 2;
      const count = Math.round((width * height) / 900);
      particles = Array.from({ length: count }, () => spawn({}));
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, width, height);
    };

    // Turbines along the right-hand horizon, as fractions of the canvas.
    const turbines = [
      { x: 0.56, base: 0.76, h: 0.15, phase: 0.4, rate: 0.9 },
      { x: 0.62, base: 0.72, h: 0.12, phase: 2.1, rate: 1.1 },
      { x: 0.72, base: 0.98, h: 0.42, phase: 1.2, rate: 0.8 },
      { x: 0.84, base: 1.0, h: 0.54, phase: 0.0, rate: 0.7 },
      { x: 0.95, base: 0.97, h: 0.38, phase: 3.3, rate: 0.85 },
    ];

    const polygon = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    const drawTurbine = (tb, angle) => {
      // On tall, narrow screens the headline fills the lower half, so the
      // farm moves up into the open sky and shrinks.
      const portrait = width / height < 0.95;
      const unit = portrait ? Math.min(height, width * 1.1) : height;
      const h = tb.h * unit * (portrait ? 0.46 : 1);
      const x = (portrait ? 0.38 + (tb.x - 0.72) * 1.6 : tb.x) * width;
      const base = (portrait ? tb.base - 0.66 : tb.base) * height;
      const hubY = base - h;
      const towerW = Math.max(1.5, h * 0.045);
      ctx.fillStyle = CREAM;
      ctx.globalAlpha = 0.85;
      polygon([
        [x - towerW * 0.45, hubY + h * 0.04],
        [x + towerW * 0.45, hubY + h * 0.04],
        [x + towerW, base],
        [x - towerW, base],
      ]);
      ctx.globalAlpha = 1;
      const L = h * 0.5;
      const root = Math.max(1, L * 0.075);
      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI * 2) / 3;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const px = -sa;
        const py = ca;
        polygon([
          [x + px * root, hubY + py * root],
          [x + ca * L * 0.55 + px * root * 0.7, hubY + sa * L * 0.55 + py * root * 0.7],
          [x + ca * L, hubY + sa * L],
          [x + ca * L * 0.55 - px * root * 0.5, hubY + sa * L * 0.55 - py * root * 0.5],
          [x - px * root * 0.6, hubY - py * root * 0.6],
        ]);
      }
      ctx.fillStyle = LIME;
      ctx.beginPath();
      ctx.arc(x, hubY, Math.max(1.2, root * 0.8), 0, Math.PI * 2);
      ctx.fill();
    };

    const step = (now) => {
      const w = windRef.current;
      if (w && w.mw.length) {
        if (now - hourStart >= hourMs) {
          hourStart = now;
          hourIndex = (hourIndex + 1) % w.mw.length;
          tickRef.current?.(hourIndex);
        }
        const target = 0.25 + 1.1 * (w.mw[hourIndex] / w.maxMw);
        strength += (target - strength) * 0.04;
      }
      const scroll = state?.current?.scroll ?? 0;
      const calm = (1 - scroll * 0.85) * strength;
      t += 0.016 * calm;
      spin += 0.035 * calm;
      ctx.fillStyle = "rgba(23, 23, 19, 0.2)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = CREAM;
      for (const p of particles) {
        const v = field(p.x, p.y, t);
        let vx = v.x * p.speed * calm;
        let vy = v.y * p.speed * calm;
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2) {
          // Inside the pointer's reach: pushed outward, swirled around it,
          // and dragged along with the pointer's own motion.
          const d = Math.sqrt(d2 + 1);
          const f = 1 - d2 / reach2;
          vx += (dx / d) * f * 2.2 - (dy / d) * f * 1.4 + pointer.vx * f * 0.9;
          vy += (dy / d) * f * 2.2 + (dx / d) * f * 1.4 + pointer.vy * f * 0.9;
        }
        p.x += vx;
        p.y += vy;
        p.life -= 1;
        if (p.x > width + 2 || p.y < -2 || p.y > height + 2 || p.life <= 0) {
          spawn(p);
          p.x = -1;
        }
        ctx.globalAlpha = p.size === 2 ? 0.9 : 0.6;
        ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      const portrait = width / height < 0.95;
      for (const tb of turbines) if (!portrait || tb.h > 0.2) drawTurbine(tb, spin * tb.rate + tb.phase);
      pointer.vx *= 0.9;
      pointer.vy *= 0.9;
      raf = requestAnimationFrame(step);
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * scale;
      const y = (e.clientY - r.top) * scale;
      if (lastPointer) {
        pointer.vx = (x - lastPointer[0]) * 0.35;
        pointer.vy = (y - lastPointer[1]) * 0.35;
      }
      lastPointer = [x, y];
      pointer.x = x;
      pointer.y = y;
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
      lastPointer = null;
    };
    // The overlays and headline sit above the canvas, so listen on the
    // nearest section instead of the canvas itself.
    const surface = canvas.closest("section") || canvas.parentElement;

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    if (reducedMotion()) {
      for (let i = 0; i < 40; i++) step(performance.now());
      cancelAnimationFrame(raf);
      return () => ro.disconnect();
    }

    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerleave", onLeave);
    };
  }, [state, hourMs]);

  return <canvas ref={ref} className={`windfield ${className}`} aria-hidden="true" />;
}
