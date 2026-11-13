import { lazy, Suspense, useCallback } from "react";
import { getHealthReadings } from "../services/api";
import useApiResource from "../hooks/useApiResource";

const AnatomyPanel = lazy(() => import("../components/AnatomyPanel"));

export default function AnatomyExplorer() {
  const loadReadings = useCallback(({ signal }) => getHealthReadings({}, { signal }), []);
  const { data, error, loading, reload } = useApiResource(loadReadings);

  return (
    <div className="app-page anatomy-explorer-page">
      <header className="app-page-header anatomy-page-heading">
        <div>
          <span className="app-eyebrow">MEDICAL EXPLORATION WORKSPACE</span>
          <h1 id="anatomy-explorer-title">Anatomy Explorer</h1>
          <p>Explore a fully suited astronaut and its related crew health readings.</p>
        </div>
        <span className="app-demo-tag">ASTRONAUT SPACESUIT · QUATERNIUS CC0</span>
      </header>

      {loading && (
        <section className="app-panel anatomy-data-state" role="status">
          <p>Loading available health readings…</p>
        </section>
      )}
      {error && (
        <section className="app-panel anatomy-data-state" role="alert">
          <h2>Unable to load anatomy health data</h2>
          <p>{error.message}</p>
          <button type="button" className="anatomy-retry-button" onClick={reload}>Retry</button>
        </section>
      )}
      <Suspense fallback={<section className="anatomy-explorer-card anatomy-component-loading" role="status">
        Preparing the interactive 3D workspace…
      </section>}>
        <AnatomyPanel readings={Array.isArray(data) ? data : []} />
      </Suspense>
      <p className="anatomy-page-note">
        Health data is provided by the backend demonstration dataset and is not live telemetry or medical guidance.
      </p>
    </div>
  );
}
