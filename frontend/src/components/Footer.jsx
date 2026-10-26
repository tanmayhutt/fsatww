import { Turbine } from "./Turbine.jsx";
import { scrollToSection } from "./Smooth.jsx";

export default function Footer({ meta }) {
  return (
    <footer className="footer band">
      <div className="container footer-grid" data-reveal>
        <div className="footer-brand">
          <span className="footer-logo">
            <Turbine size={40} />
            <span className="nav-wordmark">Wind Forecast Desk</span>
          </span>
          <p className="footer-line">
            A pilot for a GB day-ahead buying desk. Built on two public Elexon datasets and nothing else.
          </p>
        </div>
        <div className="footer-cols">
          <div>
            <p className="kicker">sections</p>
            <ul className="footer-list">
              {[
                ["#desk", "Day-ahead desk"],
                ["#accuracy", "Forecast accuracy"],
                ["#method", "Method"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} onClick={(e) => { e.preventDefault(); scrollToSection(href); }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="kicker">data</p>
            <ul className="footer-list">
              <li>Elexon BMRS, dataset WINDFOR</li>
              <li>Elexon BMRS, dataset FUELHH, fuel type WIND</li>
              <li>{meta ? `${meta.forecastRows.toLocaleString("en-GB")} forecast rows, ${meta.actualHours.toLocaleString("en-GB")} metered hours` : ""}</li>
              <li>January 2026, all times GMT</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
