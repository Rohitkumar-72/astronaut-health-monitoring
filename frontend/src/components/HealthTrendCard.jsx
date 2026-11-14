const formatValue = (value) =>
  Number.isInteger(value) ? String(value) : Number(value).toFixed(1);

export default function HealthTrendCard({ alert, label }) {
  const isBloodPressure = alert?.parameter === "Blood Pressure";
  const chartValue = (value) => {
    const numeric = isBloodPressure ? Number(String(value).split("/")[0]) : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  const samples = Array.isArray(alert?.history)
    ? alert.history.map((rawValue, index) => ({
      rawValue,
      value: chartValue(rawValue),
      timestamp: alert.historyTimestamps?.[index],
    })).filter((sample) => Number.isFinite(sample.value))
    : [];
  const values = samples.length > 0
    ? samples.map((sample) => sample.value)
    : chartValue(alert?.value) !== null
      ? [chartValue(alert.value)]
      : [];
  const plottedSamples = samples.length > 0
    ? samples
    : values.map((value) => ({ rawValue: alert?.value, value, timestamp: alert?.timestamp }));

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
  const unit = isBloodPressure ? "mmHg systolic" : alert.unit || "";

  return (
    <article className="app-panel dashboard-trend-card">
      <div className="dashboard-trend-heading">
        <div>
          <span className="dashboard-trend-kicker">SOURCE HISTORY</span>
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
          {plottedSamples.map((sample, index) => (
            <circle
              key={`${index}-${sample.value}`}
              cx={xFor(index)}
              cy={yFor(sample.value)}
              r="3.5"
              className="dashboard-chart-point"
            >
              <title>{`${isBloodPressure ? sample.rawValue : formatValue(sample.value)} ${unit} · ${sample.timestamp ? new Date(sample.timestamp).toLocaleString() : `sample ${index + 1}`}`}</title>
            </circle>
          ))}
          <text x="30" y="151" className="dashboard-chart-axis">{plottedSamples[0]?.timestamp ? new Date(plottedSamples[0].timestamp).toLocaleDateString() : "First sample"}</text>
          <text x="330" y="151" textAnchor="end" className="dashboard-chart-axis">{plottedSamples.at(-1)?.timestamp ? new Date(plottedSamples.at(-1).timestamp).toLocaleDateString() : "Latest sample"}</text>
        </svg>
      </div>
      <div className="dashboard-trend-stats">
        <span>Low <strong>{formatValue(min)} {unit}</strong></span>
        <span>Mean <strong>{formatValue(mean)} {unit}</strong></span>
        <span>High <strong>{formatValue(max)} {unit}</strong></span>
      </div>
      <p className="dashboard-trend-note">{alert.simulated ? "SIMULATED DEMO DATA · " : ""}{alert.source || "Source records"} · {isBloodPressure ? "systolic values shown in the trend" : "sample order follows the supplied data"}; no threshold assessment is implied.</p>
    </article>
  );
}
