import RiskBadge from "./RiskBadge";

const metricDefinitions = [
  { parameter: "Heart Rate", label: "Heart rate" },
  { parameter: "Blood Pressure", label: "Blood pressure" },
  { parameter: "Oxygen Saturation", label: "Oxygen saturation" },
  { parameter: "Body Temperature", label: "Body temperature" },
  { parameter: "Respiratory Rate", label: "Respiratory rate" },
  { parameter: "Sleep Duration", label: "Sleep duration" },
  { parameter: "Physical Activity", label: "Physical activity" },
  { parameter: "Stress Indicator", label: "Stress indicator" },
];

const latestFirst = (first, second) =>
  (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0);

export default function HealthCards({ alerts = [] }) {
  const readings = metricDefinitions
    .map((metric) => ({
      ...metric,
      alert: alerts
        .filter((item) => item?.parameter === metric.parameter)
        .sort(latestFirst)[0],
    }))
    .filter(({ alert }) => alert);

  if (readings.length === 0) {
    return (
      <div className="app-empty-state">
        No sample health readings are available yet.
      </div>
    );
  }

  return (
    <div className="health-metric-grid">
      {readings.map(({ parameter, label, alert }) => (
        <article className="health-metric-card" key={parameter}>
          <span className="health-metric-label">{label}</span>
          <strong className="health-metric-value">
            {alert.value} <small>{alert.unit}</small>
          </strong>
          <div className="health-metric-meta">
            <RiskBadge severity={alert.severity} />
            <span>{alert.astronautName}</span>
          </div>
        </article>
      ))}
    </div>
  );
}