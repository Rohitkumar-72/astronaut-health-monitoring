export default function RiskBadge({ severity, status }) {
  const severityClass = String(severity || "unknown").toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`app-risk-badge app-risk-${severityClass}`}>
      {severity || status || "Unclassified"}
    </span>
  );
}