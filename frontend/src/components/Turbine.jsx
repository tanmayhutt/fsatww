// A wind turbine drawn once and reused as the brand mark, the loading
// indicator and the empty-state illustration. The rotor is a separate group so
// CSS can spin it around the hub. Motion stops under prefers-reduced-motion.
export function Turbine({ size = 32, spinning = true, className = "", title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`turbine${spinning ? " turbine-spin" : ""} ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {title && <title>{title}</title>}
      <path className="turbine-tower" d="M30.2 26 27 60h10l-3.2-34z" />
      <g className="turbine-rotor">
        <path className="turbine-blade" d="M32 22c-2.4-6.2-3.4-12.6-2.6-19.3C29.6 1.4 31 .6 32 .6s2.4.8 2.6 2.1c.8 6.7-.2 13.1-2.6 19.3z" />
        <path className="turbine-blade" d="M32 22c-2.4-6.2-3.4-12.6-2.6-19.3C29.6 1.4 31 .6 32 .6s2.4.8 2.6 2.1c.8 6.7-.2 13.1-2.6 19.3z" transform="rotate(120 32 22)" />
        <path className="turbine-blade" d="M32 22c-2.4-6.2-3.4-12.6-2.6-19.3C29.6 1.4 31 .6 32 .6s2.4.8 2.6 2.1c.8 6.7-.2 13.1-2.6 19.3z" transform="rotate(240 32 22)" />
        <circle className="turbine-hub" cx="32" cy="22" r="3.2" />
      </g>
    </svg>
  );
}

export function Loading({ label = "Loading" }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-farm" aria-hidden="true">
        <Turbine size={56} className="loading-turbine loading-turbine-a" />
        <Turbine size={72} className="loading-turbine loading-turbine-b" />
        <Turbine size={48} className="loading-turbine loading-turbine-c" />
      </div>
      <div className="loading-label">{label}</div>
    </div>
  );
}
