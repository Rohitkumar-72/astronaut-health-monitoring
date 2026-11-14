export default function HealthChart({ alert, title = "Reading history" }) {
  const isBloodPressure = alert?.parameter === "Blood Pressure";
  const samples = Array.isArray(alert?.history)
    ? alert.history.map((rawValue, index) => {
      const value = rawValue;
      const parsed = isBloodPressure ? Number(String(value).split("/")[0]) : Number(value);
      return Number.isFinite(parsed)
        ? { rawValue, value: parsed, timestamp: alert.historyTimestamps?.[index] }
        : null;
    }).filter(Boolean)
    : [];
  const values = samples.map((sample) => sample.value);
  const dateLabel = (timestamp, fallback) => timestamp && Number.isFinite(Date.parse(timestamp))
    ? new Date(timestamp).toLocaleDateString()
    : fallback;

  if (values.length === 0) {
    return (
      <section className="app-panel">
        <div className="app-section-heading">
          <div>
            <h2>{title}</h2>
            <p>No historical samples are available for this metric.</p>
          </div>
        </div>
        <div className="app-empty-state">Chart unavailable</div>
      </section>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : 12 + (index / (values.length - 1)) * 76;
      const y = 84 - ((value - min) / range) * 62;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="app-panel">
      <div className="app-section-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {alert.parameter}{isBloodPressure ? " · systolic trend" : ""} · {alert.astronautName} · {alert.source || "source records"}
          </p>
        </div>
        <span className="app-chart-current">
          {alert.value} {alert.unit}
        </span>
      </div>
      <div className="app-chart-wrap">
        <svg
          className="app-health-chart"
          viewBox="0 0 100 100"
          role="img"
          aria-label={`${alert.parameter} historical source readings`}
          preserveAspectRatio="none"
        >
          {[22, 43, 64, 85].map((y) => (
            <line key={y} x1="7" x2="94" y1={y} y2={y} className="app-chart-grid" />
          ))}
          <polyline points={coordinates} className="app-chart-line" />
          {samples.map((sample, index) => {
            const { value } = sample;
            const x = values.length === 1 ? 50 : 12 + (index / (values.length - 1)) * 76;
            const y = 84 - ((value - min) / range) * 62;
            return (
              <circle key={`${index}-${value}`} cx={x} cy={y} r="1.4" className="app-chart-point">
                <title>{`${sample.rawValue} ${alert.unit || ""} · ${sample.timestamp ? new Date(sample.timestamp).toLocaleString() : `sample ${index + 1}`}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="app-chart-labels">
          <span>{dateLabel(samples[0]?.timestamp, "First sample")}</span>
          <span>{dateLabel(samples.at(-1)?.timestamp, "Latest sample")}</span>
        </div>
      </div>
      <p className="app-chart-note">
        Sample order follows the source records. Exact timestamps are shown where provided; no live sensor feed is connected.
      </p>
    </section>
  );
}