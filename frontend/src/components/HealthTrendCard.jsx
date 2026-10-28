const formatValue = (value) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export default function HealthTrendCard({ alert, label }) {
  const history = Array.isArray(alert?.history)
    ? alert.history.filter((value) => Number.isFinite(Number(value))).map(Number)
    : [];
  const values = history.length > 0
    ? history
    : Number.isFinite(Number(alert?.value))
      ? [Number(alert.value)]
      : [];

  if (values.length === 0) {
    return (
      <article className="app-panel dashboard-trend-card">
        <h3>{label}</h3>
        <p className="dashboard-no-data">No data available for this indicator.</p>
      </article>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const range = max - min || Math.max(Math.abs(max) * 0.08, 1);
  const xFor = (index) => (values.length === 1 ? 180 : 30 + (index / (values.length - 1)) * 300);
  const yFor = (value) => 126 - ((value - min) / range) * 92;
  const points = values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  const unit = alert.unit || "";

  return (
    <article className="app-panel dashboard-trend-card">
      <div className="dashboard-trend-heading">
        <div>
          <span className="dashboard-trend-kicker">SAMPLE TREND</span>
          <h3>{label}</h3>
        </div>
        <span className={`dashboard-trend-severity app-risk-${String(alert.severity || "unknown").toLowerCase()}`}>
          {alert.severity || "Unclassified"}
        </span>
      </div>
      <div className="dashboard-trend-current">
        <strong>{alert.value} <small>{unit}</small></strong>
        <span>{values.length} sample{values.length === 1 ? "" : "s"}</span>
      </div>
      <div className="dashboard-trend-chart">
        <svg
          viewBox="0 0 360 160"
          role="img"
          aria-label={`${label} sample history, ${values.length} observations, in ${unit}`}
          preserveAspectRatio="none"
        >
          {[32, 78, 124].map((y) => (
            <line key={y} x1="30" x2="330" y1={y} y2={y} className="dashboard-chart-grid" />
          ))}
          {[max, (max + min) / 2, min].map((value, index) => (
            <text key={`${value}-${index}`} x="25" y={[29, 75, 121][index]} textAnchor="end" className="dashboard-chart-axis">
              {formatValue(value)}
            </text>
          ))}
          {values.length > 1 && <polyline points={points} className="dashboard-chart-line" />}
          {values.map((value, index) => (
            <circle
              key={`${index}-${value}`}
              cx={xFor(index)}
              cy={yFor(value)}
              r="3.5"
              className="dashboard-chart-point"
            >
              <title>{`Sample ${index + 1}: ${formatValue(value)} ${unit}`}</title>
            </circle>
          ))}
          <text x="30" y="151" className="dashboard-chart-axis">First sample</text>
          <text x="330" y="151" textAnchor="end" className="dashboard-chart-axis">Latest sample</text>
        </svg>
      </div>
      <div className="dashboard-trend-stats">
        <span>Low <strong>{formatValue(min)} {unit}</strong></span>
        <span>Mean <strong>{formatValue(mean)} {unit}</strong></span>
        <span>High <strong>{formatValue(max)} {unit}</strong></span>
      </div>
      <p className="dashboard-trend-note">Sample order only; timestamps and threshold lines are not available.</p>
    </article>
  );
}
