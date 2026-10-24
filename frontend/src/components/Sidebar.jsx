import { NavLink } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard", to: "/" },
  { label: "Health Monitoring", to: "/health-monitoring" },
  { label: "Risk Alerts", to: "/risk-alerts" },
  { label: "Health History", to: "/health-history" },
  { label: "Settings", to: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <NavLink className="app-brand" to="/dashboard" aria-label="Mission Health dashboard">
        <span className="app-brand-mark" aria-hidden="true">A</span>
        <span>
          <strong>ASTRA</strong>
          <small>CREW HEALTH SYSTEM</small>
        </span>
      </NavLink>

      <div className="app-nav-label">MISSION CONSOLE</div>
      <nav className="app-navigation" aria-label="Main navigation">
        {navigationItems.map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
              className={({ isActive }) =>
                `app-nav-link${isActive ? " is-active" : ""}`
            }
          >
            <span className="app-nav-indicator" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <span className="app-status-dot" />
        <span>
          <strong>DEMO ENVIRONMENT</strong>
          <small>Sample data only</small>
        </span>
      </div>
    </aside>
  );
}