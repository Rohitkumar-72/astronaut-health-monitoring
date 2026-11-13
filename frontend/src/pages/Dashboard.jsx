import { useCallback } from "react";
import { Link } from "react-router-dom";
import HealthTrendCard from "../components/HealthTrendCard";
import RiskBadge from "../components/RiskBadge";
import { getDashboardOverview } from "../services/api";
import useApiResource from "../hooks/useApiResource";

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

const comparisonCharts = [
  { parameter: "Heart Rate", label: "Heart rate", unit: "BPM", minimum: 40, maximum: 140 },
  { parameter: "Oxygen Saturation", label: "Blood oxygen", unit: "%", minimum: 85, maximum: 100 },
  { parameter: "Sleep Duration", label: "Sleep duration", unit: "hours", minimum: 0, maximum: 10 },
  { parameter: "Physical Activity", label: "Physical activity", unit: "%", minimum: 0, maximum: 100 },
];

const crewLineColors = ["#36d5f2", "#398dff", "#a276ff", "#22c985"];

function CrewComparisonChart({ definition, readings }) {
  const series = readings
    .filter((reading) => reading.parameter === definition.parameter && Array.isArray(reading.history) && reading.history.length > 1)
    .slice(0, 4);

  return (
    <article className="dashboard-comparison-card">
      <div className="dashboard-comparison-heading">
        <div><span className="dashboard-section-kicker">CREW TREND</span><h3>{definition.label}</h3></div>
        <span>{definition.unit}</span>
      </div>
      {series.length ? (
        <>
          <div className="dashboard-comparison-plot">
            <svg viewBox="0 0 300 120" role="img" aria-label={`${definition.label} sample trends by crew member`}>
              {[25, 55, 85, 110].map((y) => <line key={y} x1="8" x2="294" y1={y} y2={y} className="dashboard-comparison-guide" />)}
              {series.map((reading, seriesIndex) => {
                const values = reading.history.map(Number).filter(Number.isFinite);
                const points = values.map((value, index) => {
                  const x = 12 + (index / (values.length - 1)) * 276;
                  const normalized = (value - definition.minimum) / (definition.maximum - definition.minimum);
                  const y = 108 - Math.max(0, Math.min(1, normalized)) * 88;
                  return { x, y, value };
                });
                return (
                  <g key={reading.crewId}>
                    <polyline points={points.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke={crewLineColors[seriesIndex]} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((point, index) => (
                      <circle key={`${reading.crewId}-${index}`} cx={point.x} cy={point.y} r="3" fill={crewLineColors[seriesIndex]}>
                        <title>{`${reading.astronautName}: ${point.value} ${definition.unit} · sample ${index + 1}`}</title>
                      </circle>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="dashboard-comparison-legend">
            {series.map((reading, index) => (
              <span key={reading.crewId}><i style={{ backgroundColor: crewLineColors[index] }} />{reading.astronautName}</span>
            ))}
          </div>
        </>
      ) : <p className="dashboard-comparison-empty">No trend samples are available for this indicator.</p>}
    </article>
  );
}

function RiskDistribution({ risks, crewCount }) {
  const levels = [
    { id: "Low", label: "Low risk", color: "#22c985" },
    { id: "Medium", label: "Moderate", color: "#f4c65e" },
    { id: "High", label: "High risk", color: "#ff963d" },
    { id: "Critical", label: "Critical", color: "#ff5268" },
  ];
  const counts = levels.map((level) => ({
    ...level,
    count: risks.filter((risk) => risk.id === level.id).length,
  }));
  const total = counts.reduce((sum, level) => sum + level.count, 0) || crewCount;
  let start = 0;
  const stops = counts.map((level) => {
    const percent = total ? (level.count / total) * 100 : 0;
    const stop = `${level.color} ${start}% ${start + percent}%`;
    start += percent;
    return stop;
  });

  return (
    <article className="dashboard-glass-panel dashboard-risk-panel">
      <div className="dashboard-panel-title">
        <div><span className="dashboard-section-kicker">RULE-BASED OVERVIEW</span><h2>Crew risk distribution</h2></div>
        <Link className="dashboard-section-link" to="/crew-overview">Details <span aria-hidden="true">→</span></Link>
      </div>
      <p className="dashboard-panel-subtitle">Illustrative bands based on available sample history; not a diagnosis.</p>
      <div className="dashboard-risk-content">
        <div className="dashboard-risk-donut" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
          <span><strong>{crewCount}</strong><small>crew</small></span>
        </div>
        <div className="dashboard-risk-legend">
          {counts.map((level) => (
            <div key={level.id}>
              <span><i style={{ backgroundColor: level.color }} />{level.label}</span>
              <strong>{level.count}<small>{total ? `${Math.round(level.count / total * 100)}%` : "0%"}</small></strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function CrewSnapshot({ crew, readings }) {
  return (
    <section className="dashboard-crew-snapshot" aria-labelledby="crew-snapshot-title">
      <div className="dashboard-section-heading">
        <div>
          <span className="dashboard-section-kicker">CREW AT A GLANCE</span>
          <h2 id="crew-snapshot-title">Crew snapshot</h2>
          <p>Roster and latest available sample indicators from the backend.</p>
        </div>
        <Link className="dashboard-section-link" to="/crew-overview">Open crew overview <span aria-hidden="true">→</span></Link>
      </div>
      <div className="dashboard-crew-grid">
        {crew.map((member) => {
          const memberReadings = readings.filter((reading) => reading.crewId === member.id);
          const latestMetrics = ["Heart Rate", "Oxygen Saturation"]
            .map((parameter) => memberReadings.find((reading) => reading.parameter === parameter))
            .filter(Boolean);
          const riskClass = String(member.risk || "unknown").toLowerCase();
          const initials = String(member.name || "Crew")
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("");

          return (
            <article className="dashboard-crew-card" key={member.id}>
              <div className="dashboard-crew-identity">
                <span className="dashboard-crew-avatar" aria-hidden="true">{initials}</span>
                <div>
                  <strong>{member.name || "Crew member"}</strong>
                  <span>{member.role || member.id}</span>
                </div>
                <span className={`dashboard-crew-risk dashboard-crew-risk-${riskClass}`}>
                  {member.risk || "Unclassified"}
                </span>
              </div>
              <div className="dashboard-crew-score">
                <span>{member.id}</span>
                <strong>{Number.isFinite(Number(member.score)) ? `${member.score}` : "—"}<small> / 100</small></strong>
              </div>
              <div className="dashboard-crew-metrics">
                {latestMetrics.map((reading) => (
                  <span key={reading.parameter}>
                    <small>{reading.parameter === "Oxygen Saturation" ? "SpO₂" : reading.parameter}</small>
                    <strong>{reading.value} <small>{reading.unit}</small></strong>
                  </span>
                ))}
                {latestMetrics.length === 0 && <span className="dashboard-crew-no-data">No current sample indicators</span>}
              </div>
            </article>
          );
        })}
        {crew.length === 0 && <p className="dashboard-comparison-empty">No crew roster is available.</p>}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const loadOverview = useCallback(({ signal }) => getDashboardOverview({ signal }), []);
  const { data: overview, error, loading, reload } = useApiResource(loadOverview);
  const alerts = overview?.alerts || [];
  const crew = overview?.crew || [];
  const mission = overview?.mission;
  const risks = overview?.risks || [];
  const healthReadings = overview?.healthReadings || [];
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
  const healthyCrew = risks.filter((risk) => risk.id === "Low").length;
  const observationCrew = risks.filter((risk) => risk.id === "Medium").length;
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "Critical").length;
  const averageScore = crew.length
    ? Math.round(crew.reduce((sum, member) => sum + (Number(member.score) || 0), 0) / crew.length)
    : 0;

  if (loading || error || !overview) {
    return (
      <div className="app-page dashboard-workspace">
        <header className="dashboard-page-heading">
          <div>
            <span className="app-eyebrow">ASTRA · MISSION HEALTH</span>
            <h1 id="dashboard-title">Mission Control</h1>
            <p>Astronaut health intelligence and mission overview · simulated data</p>
          </div>
          <div className="dashboard-data-source">
            <span className="dashboard-source-dot" />
             
          </div>
        </header>
        <section className="app-panel" role={error ? "alert" : "status"}>
          {loading && <p>Loading dashboard data from the backend…</p>}
          {error && (
            <>
              <h2>Unable to load dashboard data</h2>
              <p>{error.message}</p>
              <button type="button" className="dashboard-section-link" onClick={reload}>Retry</button>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="app-page dashboard-workspace">
      <header className="dashboard-page-heading">
        <div>
          <span className="app-eyebrow">ASTRA · MISSION HEALTH</span>
          <h1 id="dashboard-title">Mission Control</h1>
          <p>Astronaut health intelligence and mission overview</p>
        </div>
        <div className="dashboard-data-source">
           
          
        </div>
      </header>

      <section className="dashboard-mission-strip" aria-label="Mission information">
        <div className="dashboard-mission-name">
          <span className="dashboard-mission-mark" aria-hidden="true">A</span>
          <div><small>CURRENT MISSION</small><strong>{mission?.name || "Mission information unavailable"}</strong></div>
        </div>
        <div><small>MISSION DAY</small><strong>{mission ? `${mission.day} / ${mission.durationDays}` : "—"}</strong></div>
        <div><small>MISSION STATUS</small><strong className="dashboard-mission-status"><i />{mission?.status || "Unavailable"}</strong></div>
        <div><small>CREW MEMBERS</small><strong>{crew.length}</strong></div>
        <div><small>LAST SYNC</small><strong>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div>
      </section>

      <section className="dashboard-command-stats" aria-label="Crew health summary">
        <article className="dashboard-command-stat"><span className="dashboard-command-icon">◉</span><div><small>Total crew members</small><strong>{crew.length}</strong><span>Mission roster</span></div></article>
        <article className="dashboard-command-stat dashboard-command-healthy"><span className="dashboard-command-icon">✓</span><div><small>Healthy</small><strong>{healthyCrew}</strong><span>Low illustrative risk</span></div></article>
        <article className="dashboard-command-stat dashboard-command-watch"><span className="dashboard-command-icon">◷</span><div><small>Under observation</small><strong>{observationCrew}</strong><span>Moderate sample risk</span></div></article>
        <article className="dashboard-command-stat dashboard-command-critical"><span className="dashboard-command-icon">!</span><div><small>Critical alerts</small><strong>{criticalAlerts}</strong><span>Unresolved records</span></div></article>
        <article className="dashboard-command-stat dashboard-command-score"><span className="dashboard-command-icon">↗</span><div><small>Average health score</small><strong>{averageScore}<small> / 100</small></strong><span>Rule-based demo summary</span></div></article>
      </section>

      <section className="dashboard-intelligence-grid" aria-label="Crew health analytics">
        <div className="dashboard-comparison-grid">
          {comparisonCharts.map((definition) => (
            <CrewComparisonChart key={definition.parameter} definition={definition} readings={healthReadings} />
          ))}
        </div>
        <RiskDistribution risks={risks} crewCount={crew.length} />
      </section>

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

      <CrewSnapshot crew={crew} readings={healthReadings} />

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
