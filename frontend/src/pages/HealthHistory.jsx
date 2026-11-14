import { useCallback, useMemo, useState } from "react";
import RiskBadge from "../components/RiskBadge";
import { getHealthHistory, getHealthReadings, getHealthRecords } from "../services/api";
import useApiResource from "../hooks/useApiResource";

export default function HealthHistory() {
  const loadHistory = useCallback(async ({ signal }) => {
    const [alerts, readings] = await Promise.all([
      getHealthHistory({ signal }),
      getHealthReadings({}, { signal }),
    ]);
    return { alerts, readings };
  }, []);
  const { data: historyData, error, loading, reload } = useApiResource(loadHistory);
  const loadConfirmedRecords = useCallback(({ signal }) => getHealthRecords({ signal }), []);
  const {
    data: confirmedRecords,
    error: confirmedRecordsError,
    loading: confirmedRecordsLoading,
    reload: reloadConfirmedRecords,
  } = useApiResource(loadConfirmedRecords);
  const [query, setQuery] = useState("");
  const [parameterFilter, setParameterFilter] = useState("All");
  const [crewFilter, setCrewFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const records = useMemo(() => [
    ...(historyData?.alerts || []),
    ...(historyData?.readings || []).map((reading, index) => ({
      ...reading,
      id: `csv-${reading.crewId}-${reading.parameter}-${reading.timestamp || index}`,
      astronautId: reading.crewId,
      status: reading.status || "Available",
      message: reading.message || reading.source || "CSV health reading",
    })),
  ], [historyData]);
  const history = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(records || [])]
      .filter((alert) =>
        `${alert.astronautName} ${alert.astronautId} ${alert.parameter} ${alert.status}`
          .toLowerCase()
          .includes(normalizedQuery)
      )
      .filter((alert) => parameterFilter === "All" || alert.parameter === parameterFilter)
      .filter((alert) => crewFilter === "All" || alert.astronautId === crewFilter)
      .filter((alert) => {
        const timestamp = Date.parse(alert.timestamp);
        if (!Number.isFinite(timestamp)) return !startDate && !endDate;
        const date = new Date(timestamp).toISOString().slice(0, 10);
        return (!startDate || date >= startDate) && (!endDate || date <= endDate);
      })
      .sort((first, second) => (Date.parse(second.timestamp) || 0) - (Date.parse(first.timestamp) || 0));
  }, [query, records, parameterFilter, crewFilter, startDate, endDate]);
  const parameters = [...new Set((records || []).map((alert) => alert.parameter).filter(Boolean))].sort();
  const crewMembers = [...new Map((records || []).map((alert) => [alert.astronautId, alert.astronautName])).entries()];

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">RECORDED EVENTS</span>
          <h1 id="health-history-title">Health History</h1>
          <p>Review measurements and alerts supplied by the backend CSV data and confirmed reports.</p>
        </div>
        <span className="app-demo-tag">
          {historyData?.readings?.some((reading) => reading.simulated) ? "SIMULATED / SOURCE HISTORY" : "CSV / HISTORICAL DATA"}
        </span>
      </header>
      {loading || error ? (
        <section className="app-panel" role={error ? "alert" : "status"}>
          {loading && <p>Loading health history from the backend…</p>}
          {error && (
            <>
              <h2>Unable to load health history</h2>
              <p>{error.message}</p>
              <button type="button" onClick={reload}>Retry</button>
            </>
          )}
        </section>
      ) : (
      <>
      {historyData?.readings?.some((reading) => reading.simulated) && (
        <section className="app-panel dashboard-demo-notice" role="note">
          <strong>SIMULATED DEMO DATA</strong>
          <span>Generated samples are explicitly labeled and are not actual measurements or live telemetry.</span>
        </section>
      )}
      <section className="app-panel">
        <div className="app-section-heading app-history-heading">
          <div><h2>Recorded health events</h2><p>{history.length} of {records.length} records</p></div>
          <label className="app-search-label">
            Search history
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Astronaut, metric, status..." />
          </label>
        </div>
        <div className="app-history-filters" aria-label="Filter health history">
          <label className="app-select-label">Parameter
            <select value={parameterFilter} onChange={(event) => setParameterFilter(event.target.value)}>
              <option value="All">All parameters</option>
              {parameters.map((parameter) => <option key={parameter} value={parameter}>{parameter}</option>)}
            </select>
          </label>
          <label className="app-select-label">Crew member
            <select value={crewFilter} onChange={(event) => setCrewFilter(event.target.value)}>
              <option value="All">All crew</option>
              {crewMembers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="app-select-label">From
            <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="app-select-label">To
            <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <div className="app-history-list">
          {history.map((alert) => (
            <article className="app-history-row" key={alert.id}>
              <span className="app-history-marker" aria-hidden="true" />
              <div className="app-history-event">
                <div><strong>{alert.parameter}</strong><RiskBadge severity={alert.severity} /></div>
                <p>{alert.message}</p>
                <span>{alert.astronautName} · {alert.astronautId} · {alert.id}</span>
                {alert.simulated && <span className="dashboard-demo-record-label">SIMULATED DEMO RECORD</span>}
              </div>
              <div className="app-history-value">
                <strong>{alert.value} {alert.unit}</strong>
                <span>{alert.status}</span>
                <time dateTime={alert.timestamp}>{Number.isNaN(Date.parse(alert.timestamp)) ? "Unknown time" : new Date(alert.timestamp).toLocaleString()}</time>
              </div>
            </article>
          ))}
          {history.length === 0 && <p className="app-empty-state">No matching sample records.</p>}
        </div>
      </section>
      </>
      )}
      <section className="app-panel health-record-history-panel" aria-labelledby="crew-reports-heading">
        <div className="app-section-heading">
          <div>
            <h2 id="crew-reports-heading">Crew-confirmed health reports</h2>
            <p>Self-reported entries reviewed and confirmed before submission; separate from sensor readings and alerts.</p>
          </div>
        </div>
        {confirmedRecordsLoading && <p role="status">Loading confirmed reports…</p>}
        {confirmedRecordsError && (
          <div role="alert">
            <p>Unable to load confirmed reports: {confirmedRecordsError.message}</p>
            <button type="button" onClick={reloadConfirmedRecords}>Retry</button>
          </div>
        )}
        {!confirmedRecordsLoading && !confirmedRecordsError && confirmedRecords?.length === 0 && (
          <p className="app-empty-state">No astronaut-confirmed reports have been recorded in this backend session.</p>
        )}
        <div className="health-record-history-list">
          {(confirmedRecords || []).map((record) => (
            <article className="health-record-history-card" key={record.id}>
              <div className="health-record-history-heading">
                <div>
                  <strong>{record.astronautName}</strong>
                  <span>{record.astronautId} · {record.source}</span>
                </div>
                <time dateTime={record.timestamp}>
                  {Number.isNaN(Date.parse(record.timestamp)) ? "Unknown time" : new Date(record.timestamp).toLocaleString()}
                </time>
              </div>
              {record.measurements.map((measurement) => {
                const assessment = record.assessment.find((entry) => entry.parameter === measurement.parameter);
                return (
                  <div className="health-record-history-measurement" key={`${record.id}-${measurement.parameter}`}>
                    <span><strong>{measurement.parameter}</strong> · {measurement.value} {measurement.unit}</span>
                    <span>{assessment?.status || "Not assessed"}</span>
                    {assessment?.severity && <RiskBadge severity={assessment.severity} />}
                  </div>
                );
              })}
              {record.symptoms.length > 0 && (
                <p className="health-record-history-symptoms">
                  <strong>Reported symptoms:</strong> {record.symptoms.join(", ")}
                </p>
              )}
              {record.alertIds.length > 0 && (
                <p className="health-record-history-alerts">
                  Existing rule-based alert(s): {record.alertIds.join(", ")}. See Risk Alerts for current status.
                </p>
              )}
              <p className="health-record-history-caveat">
                Rule-based demonstration review only; not a diagnosis. Stored in backend memory and cleared on restart.
              </p>
            </article>
          ))}
        </div>
      </section>
      <p className="app-data-disclaimer">Sample alert history and crew-confirmed self-reports are separate. The project has no database; confirmed reports are not durable medical records.</p>
    </div>
  );
}