export default function Setting() {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">APPLICATION</span>
          <h1 id="settings-title">Settings</h1>
          <p>Project information and current dashboard configuration.</p>
        </div>
      </header>
      <section className="app-settings-grid">
        <article className="app-panel app-settings-card">
          <span className="app-settings-icon" aria-hidden="true">◎</span>
          <div><h2>Data source</h2><p>The frontend reads the shared demonstration dataset through the backend API. No live sensor feed is configured.</p></div>
          <span className="app-setting-value">Backend API · demo</span>
        </article>
        <article className="app-panel app-settings-card">
          <span className="app-settings-icon" aria-hidden="true">◷</span>
          <div><h2>Alert storage</h2><p>Alert status changes are held by the backend process and reset when it restarts.</p></div>
          <span className="app-setting-value">Backend memory</span>
        </article>
        <article className="app-panel app-settings-card">
          <span className="app-settings-icon" aria-hidden="true">◇</span>
          <div><h2>Threshold configuration</h2><p>No editable health thresholds are configured in this frontend.</p></div>
          <span className="app-setting-value">Not configured</span>
        </article>
      </section>
      <p className="app-data-disclaimer">This page reports current capabilities; it does not change system settings.</p>
    </div>
  );
}