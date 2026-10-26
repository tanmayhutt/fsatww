import { useEffect, useRef } from "react";
import { reducedMotion } from "../motion.js";

// A field of particles carried by a slowly changing wind, drawn at half
// resolution and scaled up so it reads as coarse pixels. Trails come from
// painting a translucent ink layer each frame instead of clearing.
// `state.current.scroll` (0 to 1) lets the hero slow the wind as it pins.
const INK = "#1e1d1b";
const BONE = "#f4f2ee";

export default function WindField({ state, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const scale = 0.5;
    let width = 0;
    let height = 0;
    let particles = [];
    let raf = 0;
    let t = 0;
    const pointer = { x: -1e4, y: -1e4, vx: 0 };
    let lastPointerX = null;

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
      const count = Math.round((width * height) / 900);
      particles = Array.from({ length: count }, () => spawn({}));
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, width, height);
    };

    // Turbines along the right-hand horizon, as fractions of the canvas.
    // Each has its own rotor phase so they never spin in lockstep.
    const turbines = [
      { x: 0.52, base: 0.74, h: 0.16, phase: 0.4, rate: 0.9 },
      { x: 0.585, base: 0.7, h: 0.13, phase: 2.1, rate: 1.1 },
      { x: 0.68, base: 0.97, h: 0.44, phase: 1.2, rate: 0.8 },
      { x: 0.8, base: 0.99, h: 0.56, phase: 0.0, rate: 0.7 },
      { x: 0.92, base: 0.96, h: 0.4, phase: 3.3, rate: 0.85 },
    ];

    const polygon = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    const drawTurbine = (tb, spin) => {
      // On tall, narrow screens the headline fills the lower half, so the
      // farm moves up into the open sky and shrinks.
      const portrait = width / height < 0.95;
      const unit = portrait ? Math.min(height, width * 1.1) : height;
      const h = tb.h * unit * (portrait ? 0.62 : 1);
      const x = (portrait ? 0.35 + (tb.x - 0.52) * 1.35 : tb.x) * width;
      const base = (portrait ? tb.base - 0.42 : tb.base) * height;
      const hubY = base - h;
      const towerW = Math.max(1.5, h * 0.045);
      ctx.fillStyle = BONE;
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
        const a = spin + (i * Math.PI * 2) / 3;
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
      ctx.beginPath();
      ctx.arc(x, hubY, Math.max(1.2, root * 1.1), 0, Math.PI * 2);
      ctx.fill();
    };

    let spin = 0;

    const step = () => {
      const scroll = state?.current?.scroll ?? 0;
      const calm = 1 - scroll * 0.85;
      t += 0.016 * calm;
      spin += 0.035 * calm;
      ctx.fillStyle = "rgba(30, 29, 27, 0.2)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = BONE;
      for (const p of particles) {
        const v = field(p.x, p.y, t);
        let vx = v.x * p.speed * calm;
        let vy = v.y * p.speed * calm;
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 3600) {
          const f = (1 - d2 / 3600) * 1.6;
          vx += (dx / Math.sqrt(d2 + 1)) * f + pointer.vx * 0.3;
          vy += (dy / Math.sqrt(d2 + 1)) * f;
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
      for (const tb of turbines) drawTurbine(tb, spin * tb.rate + tb.phase);
      pointer.vx *= 0.9;
      raf = requestAnimationFrame(step);
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * scale;
      pointer.vx = lastPointerX == null ? 0 : (x - lastPointerX) * 0.25;
      lastPointerX = x;
      pointer.x = x;
      pointer.y = (e.clientY - r.top) * scale;
    };
    const onLeave = () => {
      pointer.x = -1e4;
      pointer.y = -1e4;
      lastPointerX = null;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    if (reducedMotion()) {
      // Draw one still frame so the hero is not an empty block.
      for (let i = 0; i < 40; i++) step();
      cancelAnimationFrame(raf);
      return () => ro.disconnect();
    }

    canvas.parentElement.addEventListener("pointermove", onMove);
    canvas.parentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.parentElement.removeEventListener("pointermove", onMove);
      canvas.parentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [state]);

  return <canvas ref={ref} className={`windfield ${className}`} aria-hidden="true" />;
}
