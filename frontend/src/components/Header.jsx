import { Link, useLocation } from "react-router-dom";

const pageTitles = [
  ["/crew-overview", "Crew Overview"],
  ["/health-monitoring", "Health Monitoring"],
  ["/health-history", "Health History"],
  ["/risk-alerts", "Risk Alerts"],
  ["/settings", "Settings"],
];

export default function Header({ menuButtonRef, isOpen, isCollapsed, isMobile, onToggle }) {
  const { pathname } = useLocation();
  const pageTitle = pathname === "/dashboard" || pathname === "/"
    ? "Mission Dashboard"
    : pageTitles.find(([route]) => pathname.startsWith(route))?.[1] || "Mission Dashboard";

  return (
    <header className="app-topbar">
      <button
        ref={menuButtonRef}
        type="button"
        className="app-menu-toggle"
        aria-label={isMobile
          ? isOpen ? "Close navigation drawer" : "Open navigation drawer"
          : isCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
        aria-expanded={isMobile ? isOpen : !isCollapsed}
        aria-controls="app-navigation-drawer"
        onClick={onToggle}
      >
        {isOpen || (!isMobile && isCollapsed) ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      <div className="app-topbar-context">
        <span className="app-topbar-brand">ASTRA <span aria-hidden="true">/</span> MISSION CONSOLE</span>
        <strong className="app-topbar-title">{pageTitle}</strong>
      </div>
      <div className="app-topbar-actions">
        <span className="app-mission-indicator"><i aria-hidden="true" /> DEMO MISSION · NOMINAL</span>
        <span className="app-sync-indicator">SIMULATED DATA</span>
        <Link className="app-topbar-alerts" to="/risk-alerts" aria-label="Open risk alerts" title="Risk alerts">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />
          </svg>
        </Link>
        <span className="app-topbar-user"><b>MO</b><span><strong>Medical Officer</strong><small>Mission operations</small></span></span>
      </div>
    </header>
  );
}
