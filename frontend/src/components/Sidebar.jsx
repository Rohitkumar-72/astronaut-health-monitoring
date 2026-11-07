import { NavLink, useLocation } from "react-router-dom";

const navigationGroups = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", to: "/", icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
      { label: "Crew Overview", to: "/crew-overview", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87m-3-11.88a4 4 0 0 1 0 7.75" },
    ],
  },
  {
    label: "MONITORING",
    items: [
      { label: "Health Monitoring", to: "/health-monitoring", icon: "M3 12h4l3-8 4 16 3-8h4" },
      { label: "Health History", to: "/health-history", icon: "M3 12a9 9 0 1 0 2.64-6.36L3 8m0-5v5h5m4-1v5l3 2" },
      { label: "Anatomy / Body Explorer", to: "/#body-explorer", icon: "M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 6v6m-5-3 5 3 5-3m-8 7 3-4 3 4m-6-4-2 5m8-5 2 5" },
    ],
  },
  {
    label: "SAFETY",
    items: [
      { label: "Risk Alerts", to: "/risk-alerts", icon: "M12 3 2.8 20h18.4L12 3zm0 6v5m0 3h.01" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "Settings", to: "/settings", icon: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0-6v2m0 15v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64" },
    ],
  },
];

export default function Sidebar({ drawerRef, isOpen, isMobile, onNavigate, onClose }) {
  const { pathname, hash } = useLocation();

  return (
    <aside
      ref={drawerRef}
      className={`app-sidebar${isOpen ? " is-open" : ""}`}
      id="app-navigation-drawer"
      role={isMobile && isOpen ? "dialog" : "complementary"}
      aria-modal={isMobile ? isOpen : undefined}
      aria-label="ASTRA mission navigation"
      aria-hidden={isMobile ? !isOpen : undefined}
    >
      <div className="app-drawer-profile">
        <div className="app-sidebar-header">
          <NavLink
            className="app-brand"
            to="/dashboard"
            aria-label="ASTRA Crew Health System dashboard"
            onClick={onNavigate}
            tabIndex={isMobile && !isOpen ? -1 : 0}
          >
            <span className="app-brand-mark" aria-hidden="true">A</span>
            <span>
              <strong>ASTRA</strong>
              <small>ASTRONAUT HEALTH COMMAND CENTER</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="app-sidebar-close"
            aria-label="Close navigation drawer"
            onClick={onClose}
            tabIndex={isMobile && !isOpen ? -1 : 0}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="app-profile-row">
          <span className="app-profile-avatar" aria-hidden="true">CM</span>
          <span className="app-profile-copy">
            <strong>Mission Medical Officer</strong>
            <small>ASTRA mission health operations</small>
          </span>
        </div>
        <div className="app-drawer-title">
          <span>ASTRA NAVIGATION</span>
          <h2>Command Center</h2>
        </div>
      </div>

      <nav className="app-navigation-scroll" aria-label="Main navigation">
        {navigationGroups.map(({ label, items }) => (
          <section className="app-nav-group" key={label}>
            <h3 className="app-nav-label" title={label}>{label}</h3>
            <div className="app-navigation">
              {items.map(({ label: itemLabel, to, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  aria-label={itemLabel}
                  title={itemLabel}
                  aria-current={
                    (to === "/" && (pathname === "/" || pathname === "/dashboard") && !hash)
                    || (to === "/#body-explorer" && pathname === "/" && hash === "#body-explorer")
                      ? "page"
                      : undefined
                  }
                  onClick={onNavigate}
                  tabIndex={isMobile && !isOpen ? -1 : 0}
                  className={({ isActive }) => {
                    const isNavigationItemActive = to === "/#body-explorer"
                      ? pathname === "/" && hash === "#body-explorer"
                      : to === "/"
                        ? (pathname === "/" || pathname === "/dashboard") && !hash
                        : isActive;
                    return `app-nav-link${isNavigationItemActive ? " is-active" : ""}`;
                  }}
                >
                  <svg className="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={icon} />
                  </svg>
                  <span className="app-nav-text">{itemLabel}</span>
                  <span className="app-nav-arrow" aria-hidden="true">›</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <footer className="app-drawer-footer">
        MISSION CONTROL <span aria-hidden="true">·</span> ASTRA
      </footer>
    </aside>
  );
}
