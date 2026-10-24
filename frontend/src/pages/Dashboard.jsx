import { Link } from "react-router-dom";
import HealthCards from "../components/HealthCards";
import HealthChart from "../components/HealthChart";
import RiskBadge from "../components/RiskBadge";
import demoHealthData from "../data/demoHealthData";

const newestFirst = (first, second) =>
  (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0);

export default function Dashboard() {
  const alerts = demoHealthData;
  const activeAlerts = alerts.filter((alert) => alert.status !== "Resolved");
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "Critical");
  const recentAlerts = [...alerts].sort(newestFirst).slice(0, 4);
  const heartRateAlert = [...alerts]
    .filter((alert) => alert.parameter === "Heart Rate")
    .sort(newestFirst)[0];

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">MISSION HEALTH OVERVIEW</span>
          <h1 id="dashboard-title">Dashboard</h1>
          <p>Snapshot of the astronaut health demonstration dataset.</p>
        </div>
        <span className="app-demo-tag">DEMONSTRATION DATA</span>
      </header>

      <section className="app-summary-grid" aria-label="Health summary">
        <article className="app-summary-card">
          <span>Health records</span><strong>{alerts.length}</strong>
          <small>Sample alert records</small>
        </article>
        <article className="app-summary-card">
          <span>Active alerts</span><strong>{activeAlerts.length}</strong>
          <small>Not marked resolved</small>
        </article>
        <article className="app-summary-card app-summary-warning">
          <span>Critical alerts</span><strong>{criticalAlerts.length}</strong>
          <small>Requires mission-team review</small>
        </article>
        <article className="app-summary-card app-summary-ok">
          <span>Resolved alerts</span><strong>{alerts.length - activeAlerts.length}</strong>
          <small>In the available sample</small>
        </article>
      </section>

      <section className="app-content-section">
        <div className="app-section-heading">
          <div><h2>Latest sample readings</h2><p>Most recent available demo alert per health metric</p></div>
          <Link className="app-inline-link" to="/health-monitoring">View monitoring <span aria-hidden="true">→</span></Link>
        </div>
        <HealthCards alerts={alerts} />
      </section>

      <div className="app-dashboard-columns">
        {heartRateAlert && <HealthChart alert={heartRateAlert} title="Sample reading trend" />}
        <section className="app-panel app-recent-panel">
          <div className="app-section-heading">
            <div><h2>Recent health alerts</h2><p>Latest records in the demonstration data</p></div>
            <Link className="app-inline-link" to="/risk-alerts">All alerts <span aria-hidden="true">→</span></Link>
          </div>
          <div className="app-recent-list">
            {recentAlerts.map((alert) => (
              <article className="app-recent-row" key={alert.id}>
                <div><strong>{alert.parameter}</strong><span>{alert.astronautName} · {alert.id}</span></div>
                <RiskBadge severity={alert.severity} />
              </article>
            ))}
            {recentAlerts.length === 0 && <p className="app-empty-state">No sample alerts are available.</p>}
          </div>
        </section>
      </div>
      <p className="app-data-disclaimer">
        Demonstration data is illustrative only and is not live NASA telemetry or medical guidance.
      </p>
    </div>
  );
}