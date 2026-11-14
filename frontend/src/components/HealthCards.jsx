import RiskBadge from "./RiskBadge";

const latestFirst = (first, second) =>
  (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0);

export default function HealthCards({ alerts = [] }) {
  const latestByParameter = new Map();
  for (const reading of alerts) {
    if (!reading?.parameter || reading.value === null || reading.value === undefined || reading.value === "") continue;
    const current = latestByParameter.get(reading.parameter);
    if (!current || latestFirst(current, reading) >= 0) latestByParameter.set(reading.parameter, reading);
  }
  const readings = [...latestByParameter.values()];

  if (readings.length === 0) {
    return (
      <div className="app-empty-state">
        No health measurements are present in health_readings.csv.
      </div>
    );
  }

  return (
    <div className="health-metric-grid">
      {readings.map((reading) => (
        <article className="health-metric-card" key={reading.parameter}>
          <span className="health-metric-label">{reading.parameter}</span>
          <strong className="health-metric-value">
            {reading.value} <small>{reading.unit}</small>
          </strong>
          <div className="health-metric-meta">
            <RiskBadge severity={reading.severity} status={reading.status} />
            <span>{reading.astronautName} · {reading.timestamp ? new Date(reading.timestamp).toLocaleString() : "Timestamp unavailable"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}