import { useEffect, useMemo, useState } from "react";
import demoHealthData from "../data/demoHealthData";

const STORAGE_KEY = "astronaut-health-alerts-v1";

const severityLevels = ["All", "Critical", "High", "Medium", "Low"];

const statusOptions = [
  "All",
  "New",
  "Acknowledged",
  "Under Assessment",
  "Resolved",
];

const severityClass = (severity = "") =>
  severity.toLowerCase().replace(/\s+/g, "-");

const statusClass = (status = "") =>
  status.toLowerCase().replace(/\s+/g, "-");

const readInitialAlerts = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Unable to load saved alerts:", error);
  }

  return demoHealthData.map((alert) => ({ ...alert }));
};

const formatDate = (timestamp) => {
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString();
};

const formatTime = (timestamp) => {
  if (!timestamp) return "--";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

function TrendChart({ alerts }) {
  const points = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, index) => ({
      label: `${6 - index}h`,
      value: 0,
    }));
    const validTimestamps = alerts
      .map((alert) => Date.parse(alert.timestamp))
      .filter(Number.isFinite);
    const latestTimestamp = Math.max(...validTimestamps);

    if (!Number.isFinite(latestTimestamp)) return buckets;

    alerts.forEach((alert) => {
      const timestamp = Date.parse(alert.timestamp);
      if (!Number.isFinite(timestamp)) return;

      const age = latestTimestamp - timestamp;
      const hoursAgo = Math.floor(age / (60 * 60 * 1000));

      if (hoursAgo >= 0 && hoursAgo < 7) {
        buckets[6 - hoursAgo].value += 1;
      }
    });

    return buckets;
  }, [alerts]);

  const max = Math.max(...points.map((point) => point.value), 1);

  const coordinates = points
    .map((point, index) => {
      const x = 30 + index * 60;
      const y = 145 - (point.value / max) * 105;

      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `30,150 ${coordinates} 390,150`;

  return (
    <div className="ahm-chart-content">
      <svg
        className="ahm-trend-svg"
        viewBox="0 0 420 180"
        role="img"
        aria-label="Alert count trend over the last seven hours"
      >
        {[40, 75, 110, 145].map((y) => (
          <line
            key={y}
            x1="25"
            y1={y}
            x2="395"
            y2={y}
            className="ahm-chart-grid"
          />
        ))}

        <polygon points={areaPoints} className="ahm-chart-area" />

        <polyline
          points={coordinates}
          className="ahm-chart-line"
          fill="none"
        />

        {points.map((point, index) => {
          const x = 30 + index * 60;
          const y = 145 - (point.value / max) * 105;

          return (
            <g key={point.label}>
              <circle
                cx={x}
                cy={y}
                r="4"
                className="ahm-chart-dot"
              />

              <text
                x={x}
                y="170"
                textAnchor="middle"
                className="ahm-chart-label"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="ahm-chart-caption">
        Alerts grouped relative to the latest valid alert timestamp.
      </p>
    </div>
  );
}

function SeverityChart({ alerts }) {
  const categories = [
    { name: "Critical", color: "#ff5263" },
    { name: "High", color: "#ff9f43" },
    { name: "Medium", color: "#ffd166" },
    { name: "Low", color: "#4da3ff" },
  ];

  const total = alerts.length;

  let offset = 0;

  const segments = categories.map((category) => {
    const count = alerts.filter(
      (alert) => alert.severity === category.name
    ).length;

    const percentage = total ? (count / total) * 100 : 0;

    const segment = {
      ...category,
      count,
      percentage,
      offset,
    };

    offset += percentage;

    return segment;
  });

  const gradient = segments
    .filter((segment) => segment.percentage > 0)
    .map(
      (segment) =>
        `${segment.color} ${segment.offset}% ${
          segment.offset + segment.percentage
        }%`
    )
    .join(", ");

  return (
    <div className="ahm-severity-layout">
      <div
        className="ahm-donut"
        style={{
          background: total
            ? `conic-gradient(${gradient})`
            : "conic-gradient(#26354b 0% 100%)",
        }}
        role="img"
        aria-label={`Severity distribution across ${total} alerts`}
      >
        <div className="ahm-donut-inner">
          <strong>{total}</strong>
          <span>Total</span>
        </div>
      </div>

      <div className="ahm-legend">
        {segments.map((segment) => (
          <div className="ahm-legend-item" key={segment.name}>
            <span
              className="ahm-legend-dot"
              style={{ background: segment.color }}
            />

            <span>{segment.name}</span>

            <strong>{segment.count}</strong>

            <small>{Math.round(segment.percentage)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertDetailsModal({ alert, onClose, onUpdate }) {
  if (!alert) return null;

  const history = alert.history || [];

  return (
    <div
      className="ahm-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="ahm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ahm-modal-title"
      >
        <div className="ahm-modal-header">
          <div>
            <span
              className={`ahm-badge ahm-severity-${severityClass(
                alert.severity
              )}`}
            >
              {alert.severity}
            </span>

            <h2 id="ahm-modal-title">{alert.parameter}</h2>

            <p>{alert.id}</p>
          </div>

          <button
            type="button"
            className="ahm-icon-button"
            onClick={onClose}
            aria-label="Close alert details"
          >
            ✕
          </button>
        </div>

        <div className="ahm-modal-body">
          <div className="ahm-detail-grid">
            <div className="ahm-detail-item">
              <span>Astronaut</span>
              <strong>{alert.astronautName}</strong>
            </div>

            <div className="ahm-detail-item">
              <span>Astronaut ID</span>
              <strong>{alert.astronautId}</strong>
            </div>

            <div className="ahm-detail-item">
              <span>Current reading</span>
              <strong>
                {alert.value} {alert.unit}
              </strong>
            </div>

            <div className="ahm-detail-item">
              <span>Current status</span>
              <strong>{alert.status}</strong>
            </div>

            <div className="ahm-detail-item">
              <span>Detected at</span>
              <strong>{formatDate(alert.timestamp)}</strong>
            </div>
          </div>

          <div className="ahm-detail-section">
            <h3>Alert explanation</h3>
            <p>{alert.message}</p>
          </div>

          <div className="ahm-detail-section">
            <h3>Recommended next step</h3>
            <p>{alert.recommendation}</p>
          </div>

          {history.length > 0 && (
            <div className="ahm-detail-section">
              <h3>Recent readings</h3>

              <div className="ahm-reading-history">
                {history.map((value, index) => (
                  <div className="ahm-reading" key={`${value}-${index}`}>
                    <span>R{index + 1}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="ahm-disclaimer">
            This is a demonstration system. Verify sensor quality and follow
            approved mission medical procedures before taking action.
          </p>
        </div>

        <div className="ahm-modal-actions">
          {alert.status === "New" && (
            <button
              type="button"
              className="ahm-button ahm-button-secondary"
              onClick={() => onUpdate(alert.id, "Acknowledged")}
            >
              Acknowledge
            </button>
          )}

          {alert.status !== "Under Assessment" &&
            alert.status !== "Resolved" && (
              <button
                type="button"
                className="ahm-button ahm-button-primary"
                onClick={() => onUpdate(alert.id, "Under Assessment")}
              >
                Start Assessment
              </button>
            )}

          {alert.status !== "Resolved" && (
            <button
              type="button"
              className="ahm-button ahm-button-success"
              onClick={() => onUpdate(alert.id, "Resolved")}
            >
              Mark Resolved
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AlertPanel() {
  const [alerts, setAlerts] = useState(readInitialAlerts);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const selectedAlert =
    alerts.find((alert) => alert.id === selectedAlertId) || null;
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (error) {
      console.error("Unable to save alerts:", error);
    }
  }, [alerts]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => setNotice(""), 3000);

    return () => clearTimeout(timer);
  }, [notice]);

  const stats = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "Critical").length,
      active: alerts.filter((a) => a.status !== "Resolved").length,
      unacknowledged: alerts.filter((a) => a.status === "New").length,
      resolved: alerts.filter((a) => a.status === "Resolved").length,
      assessment: alerts.filter((a) => a.status === "Under Assessment").length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return alerts
      .filter((alert) => {
        const matchesSeverity =
          severityFilter === "All" || alert.severity === severityFilter;

        const matchesStatus =
          statusFilter === "All" || alert.status === statusFilter;

        const matchesSearch =
          !query ||
          [
            alert.id,
            alert.astronautId,
            alert.astronautName,
            alert.parameter,
            alert.message,
            alert.severity,
            alert.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);

        return matchesSeverity && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const severityOrder = {
          Critical: 0,
          High: 1,
          Medium: 2,
          Low: 3,
        };

        const severityDifference =
          (severityOrder[a.severity] ?? 4) -
          (severityOrder[b.severity] ?? 4);

        if (severityDifference !== 0) return severityDifference;

        return new Date(b.timestamp) - new Date(a.timestamp);
      });
  }, [alerts, severityFilter, statusFilter, search]);

  const updateAlert = (id, status) => {
    setAlerts((previous) =>
      previous.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              status,
              updatedAt: new Date().toISOString(),
            }
          : alert
      )
    );

    setNotice(`${id} updated to "${status}".`);
  };

  const addDemoAlert = () => {
    const id = `ALT-${Date.now().toString().slice(-8)}`;

    const examples = [
      {
        parameter: "Heart Rate",
        value: 112,
        unit: "BPM",
        severity: "High",
        history: [78, 82, 91, 98, 105, 112],
      },
      {
        parameter: "Oxygen Saturation",
        value: 94,
        unit: "%",
        severity: "Medium",
        history: [98, 97, 96, 95, 94, 94],
      },
      {
        parameter: "Sleep Duration",
        value: 5,
        unit: "hours",
        severity: "Medium",
        history: [8, 7, 6.5, 6, 5.5, 5],
      },
    ];

    const example = examples[Math.floor(Math.random() * examples.length)];

    const newAlert = {
      id,
      astronautId: "AST-001",
      astronautName: "Alex Morgan",
      ...example,
      status: "New",
      message: `A new simulated ${example.parameter.toLowerCase()} alert was generated.`,
      recommendation:
        "Verify the reading and follow the configured mission monitoring protocol.",
      timestamp: new Date().toISOString(),
    };

    setAlerts((previous) => [newAlert, ...previous]);
    setNotice("Demo alert created successfully.");
  };

  const exportCSV = () => {
    const headers = [
      "Alert ID",
      "Astronaut ID",
      "Astronaut Name",
      "Parameter",
      "Value",
      "Unit",
      "Severity",
      "Status",
      "Timestamp",
      "Message",
    ];

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = filteredAlerts.map((alert) => [
      alert.id,
      alert.astronautId,
      alert.astronautName,
      alert.parameter,
      alert.value,
      alert.unit,
      alert.severity,
      alert.status,
      alert.timestamp,
      alert.message,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "astronaut-health-alerts.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    setNotice("Alert report exported successfully.");
  };

  const resetDemo = () => {
    const confirmed = window.confirm(
      "Reset all alerts to the original demo data? Current status changes will be lost."
    );

    if (!confirmed) return;

    const initial = demoHealthData.map((alert) => ({ ...alert }));

    setAlerts(initial);
    setSelectedAlertId(null);
    setSearch("");
    setSeverityFilter("All");
    setStatusFilter("All");
    setNotice("Demo data restored.");
  };

  return (
    <main className="ahm-alert-page">
      <header className="ahm-page-header">
        <div>
          <div className="ahm-eyebrow">
            <span className="ahm-live-dot" />
            MISSION HEALTH SYSTEM
          </div>

          <h1>Health Alerts</h1>

          <p>
            Monitor health events, review abnormal readings, and track alert
            response.
          </p>
        </div>

        <div className="ahm-header-actions">
          <button
            type="button"
            className="ahm-button ahm-button-secondary"
            onClick={exportCSV}
          >
            ↓ Export CSV
          </button>

          <button
            type="button"
            className="ahm-button ahm-button-primary"
            onClick={addDemoAlert}
          >
            + Simulate Alert
          </button>
        </div>
      </header>

      {notice && (
        <div className="ahm-toast" role="status">
          <span>✓</span> {notice}
        </div>
      )}

      <section className="ahm-stats-grid" aria-label="Alert statistics">
        <div className="ahm-stat-card">
          <span className="ahm-stat-icon">▤</span>
          <span className="ahm-stat-label">Total Alerts</span>
          <strong>{stats.total}</strong>
          <small>All recorded alerts</small>
        </div>

        <div className="ahm-stat-card ahm-stat-critical">
          <span className="ahm-stat-icon">!</span>
          <span className="ahm-stat-label">Critical</span>
          <strong>{stats.critical}</strong>
          <small>Require prompt review</small>
        </div>

        <div className="ahm-stat-card ahm-stat-active">
          <span className="ahm-stat-icon">◉</span>
          <span className="ahm-stat-label">Active Alerts</span>
          <strong>{stats.active}</strong>
          <small>Not yet resolved</small>
        </div>

        <div className="ahm-stat-card ahm-stat-pending">
          <span className="ahm-stat-icon">◷</span>
          <span className="ahm-stat-label">Unacknowledged</span>
          <strong>{stats.unacknowledged}</strong>
          <small>Awaiting acknowledgement</small>
        </div>

        <div className="ahm-stat-card ahm-stat-resolved">
          <span className="ahm-stat-icon">✓</span>
          <span className="ahm-stat-label">Resolved</span>
          <strong>{stats.resolved}</strong>
          <small>Marked as resolved</small>
        </div>
      </section>

      <section className="ahm-charts-grid">
        <article className="ahm-panel">
          <div className="ahm-panel-heading">
            <div>
              <h2>Alert Activity</h2>
              <p>Distribution across the last seven hours</p>
            </div>

            <span className="ahm-chart-indicator">7H</span>
          </div>

          <TrendChart alerts={alerts} />
        </article>

        <article className="ahm-panel">
          <div className="ahm-panel-heading">
            <div>
              <h2>Severity Distribution</h2>
              <p>Alerts grouped by severity</p>
            </div>
          </div>

          <SeverityChart alerts={alerts} />
        </article>
      </section>

      <section className="ahm-panel ahm-alert-list-panel">
        <div className="ahm-list-heading">
          <div>
            <h2>Alert Center</h2>
            <p>
              {filteredAlerts.length} result
              {filteredAlerts.length === 1 ? "" : "s"} displayed
            </p>
          </div>

          <button
            type="button"
            className="ahm-text-button"
            onClick={resetDemo}
          >
            Reset demo data
          </button>
        </div>

        <div className="ahm-filters">
          <label className="ahm-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search astronaut, alert ID, parameter..."
              aria-label="Search alerts"
            />
          </label>

          <label className="ahm-filter-control">
            <span>Severity</span>

            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              {severityLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="ahm-filter-control">
            <span>Status</span>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ahm-alert-list">
          {filteredAlerts.length === 0 ? (
            <div className="ahm-empty-state">
              <span>⌕</span>
              <h3>No alerts found</h3>
              <p>Try changing the search or filter settings.</p>

              <button
                type="button"
                className="ahm-button ahm-button-secondary"
                onClick={() => {
                  setSearch("");
                  setSeverityFilter("All");
                  setStatusFilter("All");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <article
                key={alert.id}
                className={`ahm-alert-row ahm-row-${severityClass(
                  alert.severity
                )}`}
              >
                <div
                  className={`ahm-alert-symbol ahm-symbol-${severityClass(
                    alert.severity
                  )}`}
                  aria-hidden="true"
                >
                  {alert.severity === "Critical"
                    ? "!"
                    : alert.severity === "High"
                      ? "▲"
                      : alert.severity === "Medium"
                        ? "◆"
                        : "i"}
                </div>

                <div className="ahm-alert-main">
                  <div className="ahm-alert-title-line">
                    <h3>{alert.parameter}</h3>

                    <span
                      className={`ahm-badge ahm-severity-${severityClass(
                        alert.severity
                      )}`}
                    >
                      {alert.severity}
                    </span>
                  </div>

                  <p className="ahm-alert-description">{alert.message}</p>

                  <div className="ahm-alert-meta">
                    <span>{alert.astronautId}</span>
                    <span>{alert.astronautName}</span>
                    <span>{formatTime(alert.timestamp)}</span>
                  </div>
                </div>

                <div className="ahm-alert-reading">
                  <strong>{alert.value}</strong>
                  <span>{alert.unit}</span>
                </div>

                <div className="ahm-alert-status">
                  <span
                    className={`ahm-status ahm-status-${statusClass(
                      alert.status
                    )}`}
                  >
                    {alert.status}
                  </span>

                  <div className="ahm-row-actions">
                    <button
                      type="button"
                      className="ahm-button ahm-button-secondary ahm-small-button"
                      onClick={() => setSelectedAlertId(alert.id)}
                    >
                      Details
                    </button>

                    {alert.status === "New" && (
                      <button
                        type="button"
                        className="ahm-button ahm-button-primary ahm-small-button"
                        onClick={() =>
                          updateAlert(alert.id, "Acknowledged")
                        }
                      >
                        Acknowledge
                      </button>
                    )}

                    {alert.status === "Acknowledged" && (
                      <button
                        type="button"
                        className="ahm-button ahm-button-secondary ahm-small-button"
                        onClick={() =>
                          updateAlert(alert.id, "Under Assessment")
                        }
                      >
                        Assess
                      </button>
                    )}

                    {alert.status === "Under Assessment" && (
                      <button
                        type="button"
                        className="ahm-button ahm-button-success ahm-small-button"
                        onClick={() => updateAlert(alert.id, "Resolved")}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="ahm-list-footer">
          <span>
            {stats.assessment} alert{stats.assessment === 1 ? "" : "s"} under
            assessment
          </span>

          <span>Demo monitoring mode</span>
        </div>
      </section>

      <AlertDetailsModal
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
        onUpdate={(id, status) => updateAlert(id, status)}
      />
    </main>
  );
}