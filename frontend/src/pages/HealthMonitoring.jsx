import { useCallback, useState } from "react";
import HealthCards from "../components/HealthCards";
import HealthChart from "../components/HealthChart";
import RiskBadge from "../components/RiskBadge";
import { getHealthHistory, getHealthReadings } from "../services/api";
import useApiResource from "../hooks/useApiResource";

const metricOptions = ["Heart Rate", "Blood Pressure", "Oxygen Saturation", "Body Temperature", "Respiratory Rate", "Sleep Duration", "Physical Activity", "Stress Indicator"];

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
  const matchingAlerts = (data?.history || [])
    .filter((alert) => alert.parameter === selectedMetric)
    .sort((first, second) => (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0));
  const selectedAlert = matchingAlerts[0] || readings.find((reading) => reading.parameter === selectedMetric);

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">CREW VITALS</span>
          <h1 id="health-monitoring-title">Health Monitoring</h1>
          <p>Explore health readings and sample trends returned by the backend.</p>
        </div>
        <span className="app-demo-tag">SIMULATED / HISTORICAL DATA</span>
      </header>

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
      <section className="app-content-section">
        <div className="app-section-heading">
          <div><h2>Available health indicators</h2><p>Values are supplied by the backend demonstration dataset; they are not live sensor readings.</p></div>
        </div>
        <HealthCards alerts={readings} />
      </section>

      <section className="app-panel app-monitor-panel">
        <div className="app-section-heading app-monitor-heading">
          <div><h2>Metric history</h2><p>Sample history associated with the selected alert.</p></div>
          <label className="app-select-label">
            Metric
            <select value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
              {metricOptions.map((metric) => <option key={metric} value={metric}>{metric}</option>)}
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
      <p className="app-data-disclaimer">No live sensors are connected. These backend-served simulated readings and historical samples are not medical guidance.</p>
        </>
      )}
    </div>
  );
}