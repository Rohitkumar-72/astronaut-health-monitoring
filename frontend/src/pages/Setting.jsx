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
          <div><h2>Data source</h2><p>This dashboard currently displays the included demonstration alert data. No live sensor feed is configured.</p></div>
          <span className="app-setting-value">Demo data</span>
        </article>
        <article className="app-panel app-settings-card">
          <span className="app-settings-icon" aria-hidden="true">◷</span>
          <div><h2>Alert storage</h2><p>Risk alert status changes are saved in this browser when local storage is available.</p></div>
          <span className="app-setting-value">Browser local storage</span>
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