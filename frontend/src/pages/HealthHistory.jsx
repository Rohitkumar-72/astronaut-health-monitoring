import { useCallback, useMemo, useState } from "react";
import RiskBadge from "../components/RiskBadge";
import { getHealthHistory } from "../services/api";
import useApiResource from "../hooks/useApiResource";

export default function HealthHistory() {
  const loadHistory = useCallback(({ signal }) => getHealthHistory({ signal }), []);
  const { data: records, error, loading, reload } = useApiResource(loadHistory);
  const [query, setQuery] = useState("");
  const [parameterFilter, setParameterFilter] = useState("All");
  const [crewFilter, setCrewFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
          <p>Review health records returned by the backend demonstration dataset.</p>
        </div>
        <span className="app-demo-tag">SIMULATED / HISTORICAL DATA</span>
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
      <section className="app-panel">
        <div className="app-section-heading app-history-heading">
          <div><h2>Recorded sample events</h2><p>{history.length} of {records.length} records</p></div>
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
      )}
      <p className="app-data-disclaimer">History reflects backend-served demonstration alert data only; it is not a complete medical record.</p>
    </div>
  );
}