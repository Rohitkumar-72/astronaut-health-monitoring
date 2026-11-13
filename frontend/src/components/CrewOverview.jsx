import { useCallback, useEffect, useMemo, useState } from "react";
import RiskBadge from "./RiskBadge";
import { getDashboardOverview } from "../services/api";
import useApiResource from "../hooks/useApiResource";
import "./CrewOverview.css";

const metricDefinitions = [
  { id: "heart-rate", label: "Heart Rate", unit: "BPM", range: "60–100 BPM", max: 140 },
  { id: "blood-pressure", label: "Blood Pressure", unit: "mmHg", range: "<130/80 mmHg", max: 160 },
  { id: "oxygen-saturation", label: "SpO₂", parameter: "Oxygen Saturation", unit: "%", range: "≥95%", max: 100 },
  { id: "body-temperature", label: "Body Temperature", unit: "°C", range: "36.1–37.5 °C", max: 40 },
  { id: "respiratory-rate", label: "Respiratory Rate", unit: "breaths/min", range: "12–20 /min", max: 30 },
  { id: "sleep-duration", label: "Sleep Duration", unit: "hours", range: "7–9 hours", max: 10 },
  { id: "stress-indicator", label: "Stress Level", parameter: "Stress Indicator", unit: "%", range: "<60% demo band", max: 100 },
  { id: "physical-activity", label: "Physical Activity", parameter: "Physical Activity", unit: "%", range: "≥40% demo target", max: 100 },
];

const riskLevels = [
  { id: "Critical", label: "Critical", className: "critical", color: "#ff5268" },
  { id: "High", label: "High", className: "high", color: "#ff963d" },
  { id: "Medium", label: "Moderate", className: "moderate", color: "#f4c65e" },
  { id: "Low", label: "Low", className: "low", color: "#22c985" },
];

const comparisonOptions = [
  { id: "heart-rate", label: "Heart rate", metric: "Heart Rate", unit: "BPM", max: 140 },
  { id: "oxygen-saturation", label: "SpO₂", metric: "Oxygen Saturation", unit: "%", max: 100 },
  { id: "sleep-duration", label: "Sleep", metric: "Sleep Duration", unit: "hours", max: 10 },
  { id: "health-score", label: "Health score", metric: "Health score", unit: "/100", max: 100 },
];

const formatNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
};
const EMPTY_ARRAY = [];

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
};

const formatDate = (dateString) => {
  const date = new Date(`${dateString}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Not provided"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const getSeverityClass = (severity) => String(severity || "unknown").toLowerCase().replace(/\s+/g, "-");

function getMetricStatus(metric, reading) {
  if (!metric) return { label: "Reference unavailable", className: "unknown" };
  const value = Number(reading?.value);
  if (metric.id === "blood-pressure") {
    const [systolic, diastolic] = String(reading?.value || "").split("/").map(Number);
    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
      return { label: "No reading", className: "unknown" };
    }
    if (systolic >= 160 || diastolic >= 100) return { label: "Critical band", className: "critical" };
    if (systolic >= 140 || diastolic >= 90) return { label: "Above demo band", className: "high" };
    if (systolic >= 130 || diastolic >= 80 || systolic < 90) return { label: "Review band", className: "moderate" };
    return { label: "Within demo band", className: "low" };
  }
  if (!Number.isFinite(value)) return { label: "No reading", className: "unknown" };

  switch (metric.id) {
    case "heart-rate":
      if (value >= 120) return { label: "Critical band", className: "critical" };
      if (value > 100) return { label: "Above demo band", className: "high" };
      if (value < 60) return { label: "Review band", className: "moderate" };
      break;
    case "oxygen-saturation":
      if (value < 90) return { label: "Critical band", className: "critical" };
      if (value < 95) return { label: "Below demo band", className: "high" };
      break;
    case "body-temperature":
      if (value >= 39) return { label: "Critical band", className: "critical" };
      if (value > 37.5) return { label: "Above demo band", className: "high" };
      if (value < 36.1) return { label: "Review band", className: "moderate" };
      break;
    case "respiratory-rate":
      if (value > 24) return { label: "Critical band", className: "critical" };
      if (value > 20 || value < 12) return { label: "Outside demo band", className: "high" };
      break;
    case "sleep-duration":
      if (value < 5) return { label: "Below demo band", className: "high" };
      if (value < 7 || value > 9) return { label: "Review band", className: "moderate" };
      break;
    case "stress-indicator":
      if (value >= 85) return { label: "Critical band", className: "critical" };
      if (value >= 75) return { label: "Above demo band", className: "high" };
      if (value >= 60) return { label: "Review band", className: "moderate" };
      break;
    case "physical-activity":
      if (value < 25) return { label: "Below demo target", className: "high" };
      if (value < 40) return { label: "Review band", className: "moderate" };
      break;
    default:
      break;
  }

  return { label: "Within demo band", className: "low" };
}

function getRiskLabel(risk) {
  if (risk === "Medium") return "Under observation";
  if (risk === "High") return "High risk";
  if (risk === "Critical") return "Critical";
  return "Healthy";
}

function Icon({ name }) {
  const paths = {
    crew: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    healthy: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    observe: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    risk: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    critical: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="M12 8v4m0 4h.01" /></>,
    score: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
  };
  return (
    <svg className="crew-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.crew}
    </svg>
  );
}

function CrewAvatar({ name, large = false }) {
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
  return <span className={`crew-avatar${large ? " crew-avatar-large" : ""}`} aria-hidden="true">{initials}</span>;
}

function StatusPill({ status, label }) {
  return <span className={`crew-status-pill crew-status-${status}`}>{label}</span>;
}

function SummaryCard({ label, value, description, icon, tone }) {
  return (
    <article className={`crew-summary-card crew-summary-${tone}`}>
      <div className="crew-summary-top">
        <span className="crew-summary-icon"><Icon name={icon} /></span>
        <span className="crew-summary-label">{label}</span>
      </div>
      <strong className="crew-summary-value">{value}</strong>
      <span className="crew-summary-description">{description}</span>
    </article>
  );
}

function CrewProfileDialog({ member, memberAlerts, readings, risk, score, riskOutlook, onClose }) {
  const historyOptions = metricDefinitions.filter((metric) =>
    Array.isArray(readings[metric.id]?.history) && readings[metric.id].history.length > 1
  );
  const [selectedTrend, setSelectedTrend] = useState(historyOptions[0]?.id || "heart-rate");
  const trendMetric = historyOptions.find((metric) => metric.id === selectedTrend) || historyOptions[0];
  const trendReading = trendMetric ? readings[trendMetric.id] : undefined;
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="crew-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="crew-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="crew-profile-title">
        <header className="crew-dialog-header">
          <div className="crew-dialog-identity">
            <CrewAvatar name={member.name} large />
            <div>
              <span className="crew-section-kicker">DEMO CREW PROFILE · {member.id}</span>
              <h2 id="crew-profile-title">{member.name}</h2>
              <p>{member.role} · Age {member.age} <span>· simulated profile</span></p>
            </div>
          </div>
          <button type="button" className="crew-icon-button" aria-label="Close crew profile" onClick={onClose}>×</button>
        </header>

        <div className="crew-dialog-content">
          <section className="crew-profile-overview">
            <div><span>Current status</span><StatusPill status={risk.toLowerCase()} label={getRiskLabel(risk)} /></div>
            <div><span>Demo health score</span><strong>{score}<small> / 100</small></strong></div>
            <div><span>Last checkup · demo record</span><strong>{formatDate(member.lastCheckup)}</strong></div>
          </section>

          <div className="crew-profile-grid">
            <section className="crew-subpanel">
              <div className="crew-subpanel-heading">
                <div><span className="crew-section-kicker">CURRENT SNAPSHOT</span><h3>Health metrics</h3></div>
                <span className="crew-demo-label">DEMO / SIMULATED</span>
              </div>
              <div className="crew-profile-metrics">
                {metricDefinitions.map((metric) => {
                  const reading = readings[metric.id];
                  const status = getMetricStatus(metric, reading);
                  return (
                    <div className="crew-profile-metric" key={metric.id}>
                      <span>{metric.label}</span>
                      <strong>{reading.value} <small>{reading.unit}</small></strong>
                      <StatusPill status={status.className} label={status.label} />
                    </div>
                  );
                })}
              </div>
              <p className="crew-data-note">Values may be simulated or supplied with demonstration alert records. Reference bands are illustrative and are not medical guidance.</p>
            </section>

            <section className="crew-subpanel">
              <div className="crew-subpanel-heading">
                <div><span className="crew-section-kicker">HISTORICAL SAMPLES</span><h3>Health trends</h3></div>
                {historyOptions.length > 0 && (
                  <label className="crew-trend-select-label">
                    <span className="crew-visually-hidden">Trend parameter</span>
                    <select value={trendMetric?.id} onChange={(event) => setSelectedTrend(event.target.value)}>
                      {historyOptions.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {trendMetric && trendReading ? (
                <>
                  <ProfileTrendChart metric={trendMetric} reading={trendReading} />
                  <p className="crew-data-note">{trendReading.source}; sample timestamps are not available.</p>
                </>
              ) : <p className="crew-empty-message">No historical samples are available for this crew member.</p>}
              <div className="crew-exercise-summary">
                <div><span>Sleep sample</span><strong>{readings["sleep-duration"].value} h</strong></div>
                <div><span>Activity sample</span><strong>{readings["physical-activity"].value}%</strong></div>
                <small>Exercise and recovery history is limited to the available demo samples.</small>
              </div>
            </section>

            <section className="crew-subpanel">
              <div className="crew-subpanel-heading">
                <div><span className="crew-section-kicker">RECORDS ON FILE</span><h3>Medical history & alerts</h3></div>
              </div>
              {memberAlerts.length > 0 ? (
                <div className="crew-profile-alerts">
                  {memberAlerts.map((alert) => (
                    <article className="crew-profile-alert" key={alert.id}>
                      <div><strong>{alert.parameter}</strong><RiskBadge severity={alert.severity} status={alert.status} /></div>
                      <p>{alert.message}</p>
                      <span>{alert.value} {alert.unit} · {formatTimestamp(alert.timestamp)}</span>
                    </article>
                  ))}
                </div>
              ) : <p className="crew-empty-message">No alert records are available.</p>}
              <p className="crew-data-note">A complete personal medical history was not supplied in the demonstration data.</p>
            </section>

            <section className="crew-subpanel crew-assessment-panel">
              <div className="crew-subpanel-heading">
                <div><span className="crew-section-kicker">PREDICTED · DEMO HISTORY</span><h3>Risk outlook</h3></div>
                <span className="crew-demo-label">NOT TRAINED AI</span>
              </div>
              <StatusPill status={riskOutlook.className} label={`${riskOutlook.label} · score ${riskOutlook.score}/100`} />
              <p className="crew-assessment-copy">
                A rule-based trend projection from supplied/simulated history and unresolved demo alerts. The score is not a probability, diagnosis, or clinical score.
              </p>
              {riskOutlook.explanation.length > 0 && (
                <ul className="crew-action-list crew-explanation-list">
                  {riskOutlook.explanation.map((explanation) => <li key={explanation}>{explanation}</li>)}
                </ul>
              )}
              {riskOutlook.actions.length > 0 ? (
                <ul className="crew-action-list">
                  {riskOutlook.actions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              ) : null}
              <p className="crew-data-note">{riskOutlook.sampleCount} historical demo samples considered. Recommendations are general reminders to verify readings and follow established mission protocols.</p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfileTrendChart({ metric, reading }) {
  const values = Array.isArray(reading.history) ? reading.history.map(Number).filter(Number.isFinite) : [];
  if (values.length < 2) return <p className="crew-empty-message">Not enough samples to draw a trend.</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 25 + (index / (values.length - 1)) * 350;
    const y = 116 - ((value - min) / range) * 82;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="crew-profile-chart">
      <svg viewBox="0 0 400 150" role="img" aria-label={`${metric.label} demonstration sample sequence`}>
        {[34, 75, 116].map((y) => <line key={y} x1="24" x2="378" y1={y} y2={y} className="crew-chart-grid" />)}
        <polyline points={points} className="crew-profile-line" />
        {values.map((value, index) => {
          const x = 25 + (index / (values.length - 1)) * 350;
          const y = 116 - ((value - min) / range) * 82;
          return <circle key={`${index}-${value}`} cx={x} cy={y} r="4" className="crew-profile-point"><title>{`Sample ${index + 1}: ${formatNumber(value)} ${reading.unit}`}</title></circle>;
        })}
        <text x="24" y="142" className="crew-chart-label">Earlier sample</text>
        <text x="378" y="142" textAnchor="end" className="crew-chart-label">Latest sample</text>
      </svg>
    </div>
  );
}

function ComparisonChart({ metric, crew, readingsByCrew }) {
  const max = metric.max;
  const baseline = 174;
  const plotHeight = 126;
  const values = crew.map((member) => {
    if (metric.id === "health-score") return member.score;
    const reading = readingsByCrew[member.id][metric.metric];
    return metric.metric === "Blood Pressure"
      ? Number(String(reading.value).split("/")[0])
      : Number(reading.value);
  });

  return (
    <div className="crew-comparison-chart">
      <svg viewBox="0 0 520 225" role="img" aria-label={`${metric.label} comparison across demo crew members`}>
        {[0, 0.33, 0.66, 1].map((fraction) => {
          const y = baseline - fraction * plotHeight;
          return (
            <g key={fraction}>
              <line x1="45" x2="506" y1={y} y2={y} className="crew-chart-grid" />
              <text x="36" y={y + 4} textAnchor="end" className="crew-chart-label">{formatNumber(max * fraction)}</text>
            </g>
          );
        })}
        {crew.map((member, index) => {
          const value = values[index];
          const height = Number.isFinite(value) ? Math.max(2, (value / max) * plotHeight) : 0;
          const x = 72 + index * 108;
          const risk = metric.id === "health-score" ? member.risk : undefined;
          const metricStatus = metric.id === "health-score"
            ? risk === "Low" ? "low" : risk.toLowerCase()
            : getMetricStatus(
              metricDefinitions.find((definition) => (definition.parameter || definition.label) === metric.metric),
              readingsByCrew[member.id][metric.metric]
            ).className;
          const color = riskLevels.find((level) =>
            level.className === (metricStatus === "medium" ? "moderate" : metricStatus)
          )?.color || "#42e8d5";

          return (
            <g key={member.id}>
              <rect x={x} y={baseline - height} width="46" height={height} rx="5" fill={color} fillOpacity="0.84">
                <title>{`${member.name}: ${formatNumber(value)} ${metric.unit}`}</title>
              </rect>
              <text x={x + 23} y={baseline - height - 8} textAnchor="middle" className="crew-chart-value">{formatNumber(value)}</text>
              <text x={x + 23} y="198" textAnchor="middle" className="crew-chart-label">{member.name.split(" ")[0]}</text>
            </g>
          );
        })}
      </svg>
      <div className="crew-chart-legend">
        <span><i className="crew-legend-dot crew-status-low" />Within demo band</span>
        <span><i className="crew-legend-dot crew-status-moderate" />Review</span>
        <span><i className="crew-legend-dot crew-status-high" />Outside band</span>
      </div>
      {metric.id === "health-score" && (
        <p className="crew-data-note">Index is a simple rule summary of open demo alert severities, not a medical assessment.</p>
      )}
    </div>
  );
}

function RiskDistribution({ crew }) {
  const counts = riskLevels.map((level) => ({
    ...level,
    count: crew.filter((member) => member.risk === level.id).length,
  }));
  const total = crew.length;
  const circumference = 2 * Math.PI * 58;
  const segments = counts.map((level) => total ? (level.count / total) * circumference : 0);

  return (
    <div className="crew-risk-content">
      <div className="crew-donut-wrap">
        <svg viewBox="0 0 160 160" role="img" aria-label={counts.map(({ label, count }) => `${count} ${label.toLowerCase()}`).join(", ")}>
          <circle cx="80" cy="80" r="58" fill="none" stroke="rgb(163 179 204 / 12%)" strokeWidth="17" />
          {counts.map((level, index) => {
            const segment = segments[index];
            const offset = segments.slice(0, index).reduce((sum, length) => sum + length, 0);
            return (
              <circle
                key={level.id}
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke={level.color}
                strokeWidth="17"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
              >
                <title>{`${level.count} ${level.label} crew members`}</title>
              </circle>
            );
          })}
          <text x="80" y="77" textAnchor="middle" className="crew-donut-total">{total}</text>
          <text x="80" y="96" textAnchor="middle" className="crew-donut-caption">CREW</text>
        </svg>
      </div>
      <div className="crew-risk-legend">
        {counts.map((level) => (
          <div className="crew-risk-legend-item" key={level.id}>
            <span className="crew-risk-legend-label"><i style={{ backgroundColor: level.color }} />{level.label}</span>
            <strong>{level.count}<small>{total ? `${Math.round((level.count / total) * 100)}%` : "0%"}</small></strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CrewOverview() {
  const loadOverview = useCallback(({ signal }) => getDashboardOverview({ signal }), []);
  const { data: overview, error, loading, reload } = useApiResource(loadOverview);
  const [selectedMetricId, setSelectedMetricId] = useState(metricDefinitions[0].id);
  const [comparisonId, setComparisonId] = useState(comparisonOptions[0].id);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [astronautFilter, setAstronautFilter] = useState("All");
  const [crewSearch, setCrewSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const lastSync = overview ? new Date() : null;
  const crew = overview?.crew ?? EMPTY_ARRAY;

  const readingsByCrew = useMemo(
    () => Object.fromEntries(crew.map((member) => [member.id, member.readings])),
    [crew]
  );
  const riskOutlooks = overview?.risks ?? EMPTY_ARRAY;
  const riskOutlookByMember = useMemo(
    () => Object.fromEntries(riskOutlooks.map((outlook) => [outlook.memberId, outlook])),
    [riskOutlooks]
  );
  const trendInsights = overview?.trendInsights ?? EMPTY_ARRAY;
  const persistentWarnings = overview?.persistentWarnings ?? EMPTY_ARRAY;
  const crewAlerts = overview?.alerts ?? EMPTY_ARRAY;
  const mission = overview?.mission;
  const selectedMetric = metricDefinitions.find((metric) => metric.id === selectedMetricId) || metricDefinitions[0];
  const selectedComparison = comparisonOptions.find((option) => option.id === comparisonId) || comparisonOptions[0];
  const selectedMember = crew.find((member) => member.id === selectedMemberId);
  const totalAlerts = crewAlerts.filter((alert) => alert.status !== "Resolved");
  const averageScore = crew.length
    ? Math.round(crew.reduce((total, member) => total + member.score, 0) / crew.length)
    : 0;
  const criticalAlerts = totalAlerts.filter((alert) => alert.severity === "Critical").length;
  const highRiskMembers = riskOutlooks.filter((outlook) => outlook.id === "High" || outlook.id === "Critical").length;
  const observationMembers = riskOutlooks.filter((outlook) => outlook.id === "Medium").length;
  const healthyMembers = riskOutlooks.filter((outlook) => outlook.id === "Low").length;
  const selectedCrew = crew.filter((member) => {
    const search = crewSearch.trim().toLowerCase();
    return !search || `${member.name} ${member.id} ${member.role}`.toLowerCase().includes(search);
  });
  const filteredAlerts = crewAlerts
    .filter((alert) => severityFilter === "All" || alert.severity === severityFilter)
    .filter((alert) => astronautFilter === "All" || alert.astronautId === astronautFilter)
    .sort((first, second) => (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0));
  const abnormalCount = crew.filter(
    (member) => !["low", "unknown"].includes(getMetricStatus(selectedMetric, member.readings[selectedMetric.parameter || selectedMetric.label]).className)
  ).length;

  const openProfile = (memberId) => setSelectedMemberId(memberId);
  const closeProfile = () => setSelectedMemberId("");

  if (loading || error || !overview) {
    return (
      <main className="app-page crew-command-page">
        <header className="crew-command-header">
          <div className="crew-command-title">
            <span className="app-eyebrow">ASTRA · MISSION HEALTH OPERATIONS</span>
            <h1>Crew Health Command Center</h1>
            <p>Astronaut health &amp; mission monitoring · simulated demonstration data</p>
          </div>
          <span className="crew-demo-label">DEMONSTRATION ENVIRONMENT</span>
        </header>
        <section className="app-panel" role={error ? "alert" : "status"}>
          {loading && <p>Loading crew and health data from the backend…</p>}
          {error && (
            <>
              <h2>Unable to load crew overview</h2>
              <p>{error.message}</p>
              <button type="button" className="crew-text-button" onClick={reload}>Retry</button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-page crew-command-page">
      <header className="crew-command-header">
        <div className="crew-command-title">
          <span className="app-eyebrow">ASTRA · MISSION HEALTH OPERATIONS</span>
          <h1>Crew Health Command Center</h1>
          <p>Astronaut health &amp; mission monitoring · simulated demonstration data</p>
        </div>
        <div className="crew-header-status">
          <span className="crew-demo-label">DEMONSTRATION ENVIRONMENT</span>
          <StatusPill status={highRiskMembers > 0 ? "high" : "low"} label={highRiskMembers > 0 ? "Crew attention required" : "Crew within demo bands"} />
          <span className="crew-sync-label">Backend sync · {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </header>

      <section className="crew-mission-strip" aria-label="Mission status">
        <div className="crew-mission-name">
          <span className="crew-mission-mark" aria-hidden="true">A</span>
          <div><span className="crew-section-kicker">CURRENT MISSION · SIMULATED</span><strong>{mission.name}</strong></div>
        </div>
        <div className="crew-mission-stat"><span>MISSION DAY</span><strong>{mission.day}<small> / {mission.durationDays}</small></strong></div>
        <div className="crew-mission-stat"><span>MISSION PHASE</span><strong>{mission.phase}</strong></div>
        <div className="crew-mission-stat"><span>STATUS</span><StatusPill status="low" label={mission.status} /></div>
        <div className="crew-mission-stat"><span>DAYS REMAINING</span><strong>{Math.max(0, mission.durationDays - mission.day)}</strong></div>
      </section>

      <section className="crew-summary-grid" aria-label="Crew health summary">
        <SummaryCard label="Total crew members" value={crew.length} description="Demo roster members" icon="crew" tone="neutral" />
        <SummaryCard label="Healthy" value={healthyMembers} description="Low open-alert burden" icon="healthy" tone="low" />
        <SummaryCard label="Under observation" value={observationMembers} description="Unresolved moderate alerts" icon="observe" tone="moderate" />
        <SummaryCard label="High risk" value={highRiskMembers} description="High or critical demo alerts" icon="risk" tone="high" />
        <SummaryCard label="Critical alerts" value={criticalAlerts} description="Unresolved critical records" icon="critical" tone="critical" />
        <SummaryCard label="Average crew health score" value={`${averageScore}`} description="Illustrative rule summary · /100" icon="score" tone="neutral" />
      </section>

      <section className="crew-command-section">
        <div className="crew-section-heading">
          <div><span className="crew-section-kicker">PERSONNEL &amp; READINESS</span><h2>Crew roster</h2><p>Open a member profile for their available alerts, sample metrics, and transparent rule summary.</p></div>
          <label className="crew-search-label">
            <span className="crew-visually-hidden">Search crew</span>
            <input type="search" value={crewSearch} onChange={(event) => setCrewSearch(event.target.value)} placeholder="Search name, ID, role" />
          </label>
        </div>
        <div className="crew-roster-grid">
          {selectedCrew.map((member) => {
            const active = member.alerts.filter((alert) => alert.status !== "Resolved");
            const quickMetrics = ["Heart Rate", "Oxygen Saturation", "Sleep Duration"];
            return (
              <article className="crew-member-card" key={member.id}>
                <div className="crew-member-head">
                  <CrewAvatar name={member.name} />
                  <div className="crew-member-identity">
                    <h3>{member.name}</h3>
                    <span>{member.id} · {member.role}</span>
                  </div>
                  <StatusPill status={member.risk.toLowerCase()} label={getRiskLabel(member.risk)} />
                </div>
                <div className="crew-member-score">
                  <div><span>Demo health score</span><strong>{member.score}<small> / 100</small></strong></div>
                  <div className="crew-score-track" role="img" aria-label={`Illustrative health score ${member.score} out of 100`}>
                    <span style={{ width: `${member.score}%` }} />
                  </div>
                </div>
                <div className="crew-member-facts">
                  <span><small>AGE · DEMO</small>{member.age}</span>
                  <span><small>LAST CHECKUP · DEMO</small>{formatDate(member.lastCheckup)}</span>
                </div>
                <div className="crew-mini-metrics">
                  {quickMetrics.map((metricName) => {
                    const metric = metricDefinitions.find((item) => item.parameter === metricName);
                    const reading = member.readings[metricName];
                    const status = getMetricStatus(metric, reading);
                    return <span key={metricName} title={`${metricName}: ${status.label}`}><i className={`crew-mini-dot crew-status-${status.className}`} />{metricName === "Oxygen Saturation" ? "SpO₂" : metricName === "Sleep Duration" ? "Sleep" : "HR"} <strong>{reading.value}</strong></span>;
                  })}
                </div>
                <div className="crew-member-footer">
                  <span>{active.length} unresolved alert{active.length === 1 ? "" : "s"}</span>
                  <button type="button" className="crew-text-button" onClick={() => openProfile(member.id)}>View profile <span aria-hidden="true">→</span></button>
                </div>
              </article>
            );
          })}
          {selectedCrew.length === 0 && <p className="crew-empty-message crew-empty-card">No crew members match that search.</p>}
        </div>
      </section>

      <section className="crew-command-section">
        <div className="crew-section-heading">
          <div><span className="crew-section-kicker">CREW VITALS</span><h2>Health monitoring</h2><p>Select an indicator to review each crew member against the illustrative demo reference band.</p></div>
          <span className="crew-demo-label">SIMULATED SNAPSHOT + SUPPLIED DEMO ALERTS</span>
        </div>
        <div className="crew-metric-selector" role="group" aria-label="Choose a health indicator">
          {metricDefinitions.map((metric) => {
            const readings = crew.map((member) => member.readings[metric.parameter || metric.label]);
            const abnormal = readings.filter((reading) => !["low", "unknown"].includes(getMetricStatus(metric, reading).className)).length;
            let summary;
            if (metric.id === "blood-pressure") {
              const averageSystolic = readings.reduce(
                (total, reading) => total + Number(String(reading.value).split("/")[0]),
                0
              ) / (readings.length || 1);
              const averageDiastolic = readings.reduce(
                (total, reading) => total + Number(String(reading.value).split("/")[1]),
                0
              ) / (readings.length || 1);
              summary = `${Math.round(averageSystolic)}/${Math.round(averageDiastolic)} ${metric.unit} avg`;
            } else {
              const average = readings.reduce((total, reading) => total + Number(reading.value), 0) / (readings.length || 1);
              summary = `${formatNumber(average)} ${metric.unit} avg`;
            }
            return (
              <button type="button" key={metric.id} className={`crew-metric-tile${selectedMetricId === metric.id ? " is-selected" : ""}`} aria-pressed={selectedMetricId === metric.id} onClick={() => setSelectedMetricId(metric.id)}>
                <span>{metric.label}</span>
                <strong>{summary}</strong>
                <small>{abnormal} outside demo band</small>
              </button>
            );
          })}
        </div>
        <section className="crew-subpanel crew-monitor-panel" aria-live="polite">
          <div className="crew-subpanel-heading">
            <div><span className="crew-section-kicker">SELECTED INDICATOR</span><h3>{selectedMetric.label} · {selectedMetric.range}</h3></div>
            <span className="crew-monitor-count">{abnormalCount} of {crew.length} outside illustrative band</span>
          </div>
          <div className="crew-monitor-list">
            {crew.map((member) => {
              const reading = member.readings[selectedMetric.parameter || selectedMetric.label];
              const status = getMetricStatus(selectedMetric, reading);
              return (
                <article className="crew-monitor-row" key={member.id}>
                  <div className="crew-monitor-person"><CrewAvatar name={member.name} /><span><strong>{member.name}</strong><small>{member.id}</small></span></div>
                  <strong className={`crew-monitor-value crew-text-${status.className}`}>{reading.value} <small>{reading.unit}</small></strong>
                  <span className="crew-monitor-range">Demo reference <strong>{selectedMetric.range}</strong></span>
                  <StatusPill status={status.className} label={status.label} />
                  <span className="crew-reading-source">{reading.source}</span>
                </article>
              );
            })}
          </div>
          <p className="crew-data-note">Reference bands are illustrative display thresholds, not clinical advice. This page has no connected live sensor feed.</p>
        </section>
      </section>

      <div className="crew-dashboard-grid">
        <section className="crew-subpanel crew-comparison-panel">
          <div className="crew-subpanel-heading">
            <div><span className="crew-section-kicker">SIDE-BY-SIDE SNAPSHOT</span><h2>Crew health comparison</h2><p>Sample values across the demonstration roster.</p></div>
          </div>
          <div className="crew-chart-tabs" role="tablist" aria-label="Select comparison metric">
            {comparisonOptions.map((option) => (
              <button type="button" key={option.id} role="tab" aria-selected={comparisonId === option.id} className={comparisonId === option.id ? "is-selected" : ""} onClick={() => setComparisonId(option.id)}>{option.label}</button>
            ))}
          </div>
          <ComparisonChart metric={selectedComparison} crew={crew} readingsByCrew={readingsByCrew} />
        </section>

        <section className="crew-subpanel crew-risk-panel">
          <div className="crew-subpanel-heading">
            <div><span className="crew-section-kicker">OPEN ALERT SEVERITY</span><h2>Crew risk distribution</h2><p>Highest unresolved supplied alert per demo crew member.</p></div>
          </div>
          <RiskDistribution crew={crew} />
          <p className="crew-data-note">Categories summarize supplied alert labels only; they are not clinical risk predictions.</p>
        </section>
      </div>

      <section className="crew-command-section crew-prediction-section">
        <div className="crew-section-heading">
          <div>
            <span className="crew-section-kicker">HISTORICAL TREND REVIEW</span>
            <h2>Crew risk outlook</h2>
            <p>Heuristic attention scores from available sample trends and unresolved demo alert labels.</p>
          </div>
          <span className="crew-demo-label">RULE-BASED · NOT TRAINED AI</span>
        </div>
        <div className="crew-prediction-grid">
          {riskOutlooks.map((outlook) => {
            const member = crew.find((crewMember) => crewMember.id === outlook.memberId);
            return (
              <article className={`crew-prediction-card crew-prediction-${outlook.className}`} key={outlook.memberId}>
                <div className="crew-prediction-header">
                  <div className="crew-prediction-identity">
                    <CrewAvatar name={member.name} />
                    <span><strong>{member.name}</strong><small>{member.id} · {member.role}</small></span>
                  </div>
                  <StatusPill status={outlook.className} label={outlook.label} />
                </div>
                <div className="crew-prediction-score">
                  <span>Trend attention score · not probability</span>
                  <strong>{outlook.score}<small> / 100</small></strong>
                </div>
                <div className="crew-prediction-track" role="img" aria-label={`Rule-based trend attention score ${outlook.score} out of 100`}>
                  <span style={{ width: `${outlook.score}%` }} />
                </div>
                <div className="crew-prediction-explanation">
                  <strong>Why this outlook</strong>
                  <ul>{outlook.explanation.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="crew-prediction-actions">
                  <strong>Suggested preventive follow-up</strong>
                  <ul>{outlook.actions.map((action) => <li key={action}>{action}</li>)}</ul>
                </div>
                <button type="button" className="crew-text-button" onClick={() => openProfile(member.id)}>Open profile <span aria-hidden="true">→</span></button>
              </article>
            );
          })}
        </div>
        <p className="crew-data-note">
          Heuristic score combines directional changes in historical demo/simulated samples with unresolved alert severity. Thresholds are illustrative; the score is not a probability, trained AI output, diagnosis, or clinical risk assessment. Sample timestamps are unavailable.
        </p>
      </section>

      <div className="crew-dashboard-grid crew-intelligence-grid">
        <section className="crew-subpanel crew-trend-insights-panel">
          <div className="crew-subpanel-heading">
            <div>
              <span className="crew-section-kicker">CREW-WIDE HISTORICAL PATTERNS</span>
              <h2>Shared trend signals</h2>
              <p>Common directions or notable individual changes across supplied sample sequences.</p>
            </div>
          </div>
          {trendInsights.length > 0 ? (
            <div className="crew-trend-insights-list">
              {trendInsights.map((insight) => (
                <article className="crew-trend-insight" key={insight.id}>
                  <span className="crew-insight-glyph" aria-hidden="true">{insight.id === "sleep-decline" ? "Z" : insight.id === "stress-increase" ? "!" : "↕"}</span>
                  <div>
                    <h3>{insight.headline}</h3>
                    <p>{insight.summary}</p>
                    <ul>{insight.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                    <small>{insight.caveat}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="crew-empty-message">No shared trend direction is supported by at least two available crew histories.</p>
          )}
          <p className="crew-data-note">These are descriptive sample comparisons only; no causal relationship or medical correlation is inferred.</p>
        </section>

        <section className="crew-subpanel crew-early-warning-panel">
          <div className="crew-subpanel-heading">
            <div>
              <span className="crew-section-kicker">EARLY WARNING · DEMO HISTORY</span>
              <h2>Persistent out-of-band samples</h2>
              <p>Latest two consecutive samples outside an illustrative band.</p>
            </div>
            <span className="crew-alert-total">{persistentWarnings.length} warnings</span>
          </div>
          {persistentWarnings.length > 0 ? (
            <div className="crew-warning-list">
              {persistentWarnings.map((warning) => (
                <article className="crew-warning-row" key={warning.id}>
                  <span className={`crew-alert-marker crew-status-${getSeverityClass(warning.severity)}`} aria-hidden="true" />
                  <div className="crew-warning-content">
                    <div className="crew-warning-title"><strong>{warning.name}</strong><RiskBadge severity={warning.severity} /></div>
                    <p>{warning.metric} · {warning.value} {warning.unit}</p>
                    <span>{warning.timestamp ? `Source alert · ${formatTimestamp(warning.timestamp)}` : "Timestamp unavailable in source data"}</span>
                    <small>{warning.sampleCount} consecutive demo samples · {warning.source}</small>
                    <p className="crew-warning-action"><strong>Suggested action:</strong> {warning.action}</p>
                  </div>
                  <button type="button" className="crew-text-button" onClick={() => openProfile(warning.memberId)}>Profile <span aria-hidden="true">→</span></button>
                </article>
              ))}
            </div>
          ) : (
            <p className="crew-empty-message">No parameters are outside their illustrative band for two consecutive available samples.</p>
          )}
          <p className="crew-data-note">Warnings are derived from static demo history, are not continuous sensor monitoring, and are deduplicated against matching unresolved alert records.</p>
        </section>
      </div>

      <div className="crew-dashboard-grid crew-lower-grid">
        <section className="crew-subpanel crew-alert-panel">
          <div className="crew-subpanel-heading">
            <div><span className="crew-section-kicker">SUPPLIED ALERTS + DEDUPLICATED WARNINGS</span><h2>Recent medical alerts</h2><p>Persistent conditions link to their matching warning rather than creating duplicate alert rows.</p></div>
            <span className="crew-alert-total">{filteredAlerts.length} records</span>
          </div>
          <div className="crew-alert-filters">
            <label>Severity
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                {["All", "Critical", "High", "Medium", "Low"].map((severity) => <option key={severity}>{severity}</option>)}
              </select>
            </label>
            <label>Astronaut
              <select value={astronautFilter} onChange={(event) => setAstronautFilter(event.target.value)}>
                <option value="All">All crew</option>
                {crew.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
          </div>
          <div className="crew-alert-list">
            {filteredAlerts.map((alert) => (
              <article className="crew-alert-row" key={alert.id}>
                <span className={`crew-alert-marker crew-status-${getSeverityClass(alert.severity)}`} aria-hidden="true" />
                <div className="crew-alert-main">
                  <div className="crew-alert-heading"><strong>{alert.parameter}</strong><RiskBadge severity={alert.severity} status={alert.status} /></div>
                  {alert.persistentWarning && (
                    <span className="crew-persistent-tag">{alert.persistentWarning.sampleCount} consecutive abnormal samples · early warning linked</span>
                  )}
                  <span className="crew-alert-member">{alert.astronautName} · {alert.astronautId}</span>
                  <p>{alert.message || "No description was supplied."}</p>
                  <span className="crew-alert-action"><strong>Suggested action:</strong> {alert.recommendation || "No action supplied in this record."}</span>
                </div>
                <div className="crew-alert-value"><strong>{alert.value} <small>{alert.unit}</small></strong><time dateTime={alert.timestamp}>{formatTimestamp(alert.timestamp)}</time><button type="button" onClick={() => openProfile(alert.astronautId)}>View profile</button></div>
              </article>
            ))}
            {filteredAlerts.length === 0 && <p className="crew-empty-message">No alert records match the selected filters.</p>}
          </div>
        </section>

        <div className="crew-side-stack">
          <section className="crew-subpanel crew-mission-panel">
            <div className="crew-subpanel-heading">
              <div><span className="crew-section-kicker">MISSION CONTEXT</span><h2>Mission information</h2></div>
            </div>
            <dl className="crew-mission-details">
              <div><dt>Mission</dt><dd>{mission.name}</dd></div>
              <div><dt>Duration</dt><dd>{mission.durationDays} days</dd></div>
              <div><dt>Current day</dt><dd>Day {mission.day}</dd></div>
              <div><dt>Days remaining</dt><dd>{Math.max(0, mission.durationDays - mission.day)}</dd></div>
              <div><dt>Crew size</dt><dd>{crew.length} demo members</dd></div>
              <div><dt>Mission phase</dt><dd>{mission.phase}</dd></div>
              <div><dt>Status</dt><dd><StatusPill status="low" label={mission.status} /></dd></div>
            </dl>
            <p className="crew-data-note">Mission values are fictional demonstration data and do not describe an actual NASA mission.</p>
          </section>
        </div>
      </div>

      <p className="crew-global-disclaimer">
        Demonstration records are not live telemetry. Supplemental metrics, mission details, roster demographics, risk outlooks, and warnings are simulated or illustrative. Risk summaries are rule-based, not trained AI; consult verified medical protocols for decisions.
      </p>

      {selectedMember && (
        <CrewProfileDialog
          key={selectedMember.id}
          member={selectedMember}
          memberAlerts={selectedMember.alerts}
          readings={selectedMember.readings}
          risk={selectedMember.risk}
          score={selectedMember.score}
          riskOutlook={riskOutlookByMember[selectedMember.id]}
          onClose={closeProfile}
        />
      )}
    </main>
  );
}
