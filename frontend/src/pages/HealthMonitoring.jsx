import { useCallback, useState } from "react";
import HealthCards from "../components/HealthCards";
import HealthChart from "../components/HealthChart";
import HealthRecordCapture from "../components/HealthRecordCapture";
import RiskBadge from "../components/RiskBadge";
import { getHealthHistory, getHealthReadings } from "../services/api";
import useApiResource from "../hooks/useApiResource";

const metricOptions = [
  "Heart Rate",
  "Blood Pressure",
  "Oxygen Saturation",
  "Body Temperature",
  "Respiratory Rate",
  "Sleep Duration",
  "Physical Activity",
  "Stress Indicator",
  "Bone Density",
  "Mood",
  "Daily Calorie Intake",
  "Muscular Endurance Score",
  "Cognitive Reaction Time",
  "Hydration Status",
  "Heart Rate Variability",
  "Cumulative Radiation Dose",
];

export default function HealthMonitoring() {
  const loadHealthData = useCallback(async ({ signal }) => {
    const [readings, history] = await Promise.all([
      getHealthReadings({}, { signal }),
      getHealthHistory({ signal }),
    ]);
    return { readings, history };
  }, []);
  const { data, error, loading, reload } = useApiResource(loadHealthData);
  const [selectedMetric, setSelectedMetric] = useState(metricOptions[0]);
  const readings = data?.readings || [];
  const availableMetrics = [...new Set([...metricOptions, ...readings.map((reading) => reading.parameter)])];
  const matchingAlerts = [...(data?.history || [])].reverse()
    .filter((alert) => alert.parameter === selectedMetric)
    .sort((first, second) => (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0));
  const selectedReading = [...readings].reverse()
    .filter((reading) => reading.parameter === selectedMetric)
    .sort((first, second) => (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0))[0];
  const selectedAlert = selectedReading
    ? {
      ...selectedReading,
      severity: matchingAlerts[0]?.severity || selectedReading.severity,
      status: matchingAlerts[0]?.status || selectedReading.status,
    }
    : matchingAlerts[0];

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">CREW VITALS</span>
          <h1 id="health-monitoring-title">Health Monitoring</h1>
          <p>Explore source-labeled measurements, timestamps, and historical trends supplied by the backend.</p>
        </div>
        <span className="app-demo-tag">{readings.some((reading) => reading.simulated) ? "SIMULATED / SOURCE DATA" : "CSV / SOURCE DATA"}</span>
      </header>

      <section className="app-content-section" aria-labelledby="health-voice-heading">
        <div className="app-section-heading">
          <div>
            <h2 id="health-voice-heading">Voice health input</h2>
            <p>Dictate a report, review the extracted values, choose the astronaut, and confirm before saving.</p>
          </div>
        </div>
        <HealthRecordCapture onSaved={reload} />
      </section>

      {loading || error ? (
        <section className="app-panel" role={error ? "alert" : "status"}>
          {loading && <p>Loading health readings from the backend…</p>}
          {error && (
            <>
              <h2>Unable to load health data</h2>
              <p>{error.message}</p>
              <button type="button" onClick={reload}>Retry</button>
            </>
          )}
        </section>
      ) : (
        <>
      {readings.some((reading) => reading.simulated) && (
        <section className="app-panel dashboard-demo-notice" role="note">
          <strong>SIMULATED DEMO DATA</strong>
          <span>Generated health samples are not actual astronaut measurements, live telemetry, or medical assessments.</span>
        </section>
      )}
      <section className="app-content-section">
        <div className="app-section-heading">
          <div><h2>Available health indicators</h2><p>Measurements are shown only when present in the backend CSV or confirmed records; they are not live sensor readings.</p></div>
        </div>
        <HealthCards alerts={readings} />
      </section>

      <section className="app-panel app-monitor-panel">
        <div className="app-section-heading app-monitor-heading">
          <div><h2>Metric history</h2><p>Source history associated with the selected measurement or alert.</p></div>
          <label className="app-select-label">
            Metric
            <select value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
              {availableMetrics.map((metric) => <option key={metric} value={metric}>{metric}</option>)}
            </select>
          </label>
        </div>
        {selectedAlert ? (
          <>
            <div className="app-monitor-reading">
              <strong>{selectedAlert.value} <small>{selectedAlert.unit}</small></strong>
              <RiskBadge severity={selectedAlert.severity} status={selectedAlert.status} />
              <span>{selectedAlert.astronautName} · {selectedAlert.astronautId}</span>
            </div>
            <HealthChart alert={selectedAlert} title={`${selectedMetric} sample history`} />
          </>
        ) : (
          <p className="app-empty-state">No sample data is available for {selectedMetric}.</p>
        )}
      </section>
      <p className="app-data-disclaimer">No live sensors are connected. Source readings and historical samples are informational, not medical guidance.</p>
        </>
      )}
    </div>
  );
}