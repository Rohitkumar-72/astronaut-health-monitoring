import { useState } from "react";
import HealthCards from "../components/HealthCards";
import HealthChart from "../components/HealthChart";
import RiskBadge from "../components/RiskBadge";
import demoHealthData from "../data/demoHealthData";

const metricOptions = ["Heart Rate", "Oxygen Saturation", "Body Temperature", "Sleep Duration", "Physical Activity", "Stress Indicator"];

export default function HealthMonitoring() {
  const [selectedMetric, setSelectedMetric] = useState(metricOptions[0]);
  const matchingAlerts = demoHealthData
    .filter((alert) => alert.parameter === selectedMetric)
    .sort((first, second) => (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0));
  const selectedAlert = matchingAlerts[0];

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">CREW VITALS</span>
          <h1 id="health-monitoring-title">Health Monitoring</h1>
          <p>Explore available sample health readings and their recorded trends.</p>
        </div>
        <span className="app-demo-tag">DEMONSTRATION DATA</span>
      </header>

      <section className="app-content-section">
        <div className="app-section-heading">
          <div><h2>Available health indicators</h2><p>Values come from the included demo alert records.</p></div>
        </div>
        <HealthCards alerts={demoHealthData} />
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
      <p className="app-data-disclaimer">No live sensors are connected. These readings are demonstration data, not medical guidance.</p>
    </div>
  );
}