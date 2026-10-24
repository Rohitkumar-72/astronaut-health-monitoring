export default function HealthChart({ alert, title = "Reading history" }) {
  const values = Array.isArray(alert?.history)
    ? alert.history.filter((value) => Number.isFinite(Number(value))).map(Number)
    : [];

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
            {alert.parameter} · {alert.astronautName} · demonstration samples
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
          aria-label={`${alert.parameter} historical demonstration readings`}
          preserveAspectRatio="none"
        >
          {[22, 43, 64, 85].map((y) => (
            <line key={y} x1="7" x2="94" y1={y} y2={y} className="app-chart-grid" />
          ))}
          <polyline points={coordinates} className="app-chart-line" />
          {values.map((value, index) => {
            const x = values.length === 1 ? 50 : 12 + (index / (values.length - 1)) * 76;
            const y = 84 - ((value - min) / range) * 62;
            return <circle key={`${index}-${value}`} cx={x} cy={y} r="1.4" className="app-chart-point" />;
          })}
        </svg>
        <div className="app-chart-labels">
          {values.map((_, index) => <span key={index}>Sample {index + 1}</span>)}
        </div>
      </div>
      <p className="app-chart-note">
        Sample values supplied with the demonstration alert; not live sensor data.
      </p>
    </section>
  );
}