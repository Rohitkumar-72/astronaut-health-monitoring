import { Link } from "react-router-dom";
import AnatomyPanel from "../components/AnatomyPanel";
import HealthTrendCard from "../components/HealthTrendCard";
import RiskBadge from "../components/RiskBadge";
import demoHealthData from "../data/demoHealthData";

const metricDefinitions = [
  { parameter: "Heart Rate", label: "Heart rate" },
  { parameter: "Oxygen Saturation", label: "Oxygen saturation" },
  { parameter: "Body Temperature", label: "Body temperature" },
  { parameter: "Sleep Duration", label: "Sleep duration" },
  { parameter: "Physical Activity", label: "Physical activity" },
  { parameter: "Stress Indicator", label: "Stress indicator" },
];

const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const dateValue = (timestamp) => {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
};

const newestFirst = (first, second) => dateValue(second.timestamp) - dateValue(first.timestamp);

const getLatestByMetric = (alerts) => {
  const latest = new Map();
  for (const alert of alerts) {
    if (!alert?.parameter || !Number.isFinite(Number(alert.value))) continue;
    const current = latest.get(alert.parameter);
    if (!current || dateValue(alert.timestamp) > dateValue(current.timestamp)) {
      latest.set(alert.parameter, alert);
    }
  }
  return latest;
};

const formatTimestamp = (timestamp) => {
  const time = dateValue(timestamp);
  return time ? new Date(time).toLocaleString() : "Timestamp unavailable";
};

function TrendMark({ history }) {
  const values = Array.isArray(history) ? history.filter((value) => Number.isFinite(Number(value))).map(Number) : [];
  if (values.length < 2) return <span className="dashboard-kpi-mark">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 2 + (index / (values.length - 1)) * 56;
    const y = 18 - ((value - min) / range) * 14;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="dashboard-kpi-sparkline" viewBox="0 0 60 22" role="img" aria-label="Sample trend">
      <polyline points={points} />
    </svg>
  );
}

function MetricKpi({ label, alert }) {
  return (
    <article className="dashboard-kpi-card">
      <div className="dashboard-kpi-top">
        <span>{label}</span>
        {alert && <RiskBadge severity={alert.severity} />}
      </div>
      {alert ? (
        <div className="dashboard-kpi-value-row">
          <strong>{alert.value} <small>{alert.unit}</small></strong>
          <TrendMark history={alert.history} />
        </div>
      ) : (
        <strong className="dashboard-kpi-unavailable">No data</strong>
      )}
      <span className="dashboard-kpi-caption">
        {alert ? `Latest sample · ${alert.astronautName}` : "Not present in the current dataset"}
      </span>
    </article>
  );
}

function AlertItem({ alert }) {
  return (
    <article className="dashboard-alert-item">
      <span className={`dashboard-alert-mark dashboard-alert-${String(alert.severity || "unknown").toLowerCase()}`} aria-hidden="true" />
      <div className="dashboard-alert-copy">
        <div className="dashboard-alert-title">
          <strong>{alert.parameter}</strong>
          <RiskBadge severity={alert.severity} />
        </div>
        <p>{alert.message || "No reason was supplied for this alert."}</p>
        <span>{alert.astronautName || "Crew member"} · {formatTimestamp(alert.timestamp)}</span>
      </div>
      <strong className="dashboard-alert-value">{alert.value} {alert.unit}</strong>
    </article>
  );
}

export default function Dashboard() {
  const alerts = Array.isArray(demoHealthData) ? demoHealthData : [];
  const sortedAlerts = [...alerts].sort(newestFirst);
  const latestByMetric = getLatestByMetric(alerts);
  const latestHeartRate = latestByMetric.get("Heart Rate");
  const latestOxygen = latestByMetric.get("Oxygen Saturation");
  const activeAlerts = sortedAlerts.filter((alert) => alert.status && alert.status !== "Resolved");
  const priorityAlerts = [...activeAlerts]
    .sort((first, second) =>
      (severityOrder[first.severity] ?? 4) - (severityOrder[second.severity] ?? 4) || newestFirst(first, second)
    )
    .slice(0, 4);
  const observationCount = alerts.reduce(
    (count, alert) => count + (Array.isArray(alert.history)
      ? alert.history.filter((value) => Number.isFinite(Number(value))).length
      : Number.isFinite(Number(alert.value)) ? 1 : 0),
    0
  );
  const validMetrics = metricDefinitions.filter(({ parameter }) => latestByMetric.has(parameter));

  return (
    <div className="app-page dashboard-workspace">
      <header className="dashboard-page-heading">
        <div>
          <span className="app-eyebrow">ASTRA · MISSION HEALTH</span>
          <h1 id="dashboard-title">Astronaut Health Intelligence</h1>
          <p>Health observations and risk indicators from the available demonstration dataset.</p>
        </div>
        <div className="dashboard-data-source">
          <span className="dashboard-source-dot" />
          <span>DEMONSTRATION DATA</span>
        </div>
      </header>

      <section className="dashboard-kpi-grid" aria-label="Latest health indicators">
        <MetricKpi label="Heart rate" alert={latestHeartRate} />
        <MetricKpi label="Oxygen saturation" alert={latestOxygen} />
        <MetricKpi label="Body temperature" alert={latestByMetric.get("Body Temperature")} />
        <article className="dashboard-kpi-card dashboard-alert-count-card">
          <div className="dashboard-kpi-top"><span>Active risk alerts</span><span className="dashboard-count-icon" aria-hidden="true">!</span></div>
          <div className="dashboard-kpi-value-row"><strong>{activeAlerts.length}<small> / {alerts.length} records</small></strong></div>
          <span className="dashboard-kpi-caption">Based on existing alert status labels</span>
        </article>
        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top"><span>Tracked indicators</span><span className="dashboard-count-icon dashboard-violet-icon" aria-hidden="true">◈</span></div>
          <div className="dashboard-kpi-value-row"><strong>{validMetrics.length}<small> / {metricDefinitions.length}</small></strong></div>
          <span className="dashboard-kpi-caption">{observationCount} supplied sample observations</span>
        </article>
      </section>

      <AnatomyPanel readings={alerts} />

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">OBSERVATION HISTORY</span>
            <h2>Health trends</h2>
            <p>Historical samples from the included alert records. Exact sample times and configured thresholds are unavailable.</p>
          </div>
          <Link className="dashboard-section-link" to="/health-monitoring">Open health monitoring <span aria-hidden="true">→</span></Link>
        </div>
        {validMetrics.length > 0 ? (
          <div className="dashboard-trend-grid">
            {metricDefinitions.map(({ parameter, label }) => {
              const alert = latestByMetric.get(parameter);
              return alert ? <HealthTrendCard key={parameter} alert={alert} label={label} /> : null;
            })}
          </div>
        ) : (
          <div className="app-panel dashboard-empty-panel">No health measurements are available in the current dataset.</div>
        )}
      </section>

      <section className="dashboard-bottom-grid">
        <section className="app-panel dashboard-alerts-panel">
          <div className="dashboard-section-heading dashboard-panel-heading">
            <div>
              <span className="dashboard-section-kicker">EXISTING RISK FLAGS</span>
              <h2>Priority alerts</h2>
              <p>Severity and reason as provided in the demonstration records.</p>
            </div>
            <Link className="dashboard-section-link" to="/risk-alerts">All alerts <span aria-hidden="true">→</span></Link>
          </div>
          <div className="dashboard-alert-list">
            {priorityAlerts.map((alert) => <AlertItem key={alert.id} alert={alert} />)}
            {priorityAlerts.length === 0 && <p className="dashboard-no-data">No active alerts are available.</p>}
          </div>
        </section>

        <section className="app-panel dashboard-readings-panel">
          <div className="dashboard-section-heading dashboard-panel-heading">
            <div>
              <span className="dashboard-section-kicker">RECENT RECORDS</span>
              <h2>Health readings</h2>
              <p>Latest alert observations, not a complete sensor stream.</p>
            </div>
            <Link className="dashboard-section-link" to="/health-history">History <span aria-hidden="true">→</span></Link>
          </div>
          <div className="dashboard-table-wrap">
            <table className="dashboard-readings-table">
              <thead>
                <tr><th>Observation</th><th>Reading</th><th>Status</th></tr>
              </thead>
              <tbody>
                {sortedAlerts.slice(0, 6).map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <strong>{alert.parameter}</strong>
                      <span>{alert.astronautName} · {formatTimestamp(alert.timestamp)}</span>
                    </td>
                    <td>{alert.value} {alert.unit}</td>
                    <td><RiskBadge severity={alert.severity} status={alert.status} /></td>
                  </tr>
                ))}
                {sortedAlerts.length === 0 && (
                  <tr><td colSpan="3" className="dashboard-no-data">No data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <p className="app-data-disclaimer">
        Demonstration data only. This dashboard is not live telemetry, a medical record, a diagnostic system, or medical guidance.
      </p>
    </div>
  );
}
