const stateLabels = {
  idle: "Standing by",
  listening: "Listening",
  processing: "Thinking",
  speaking: "Speaking",
  error: "Needs attention",
};

export default function AssistantOrb({ state = "idle", compact = false }) {
  return (
    <div
      className={`astra-orb-stage${compact ? " astra-orb-stage-compact" : ""}`}
      data-state={state}
      role="img"
      aria-label={`ASTRA AI ${stateLabels[state] || stateLabels.idle}`}
    >
      <div className={`astra-orb astra-orb-${state}`} aria-hidden="true">
        <span className="astra-orb-core" />
        <span className="astra-orb-ring astra-orb-ring-one" />
        <span className="astra-orb-ring astra-orb-ring-two" />
        <span className="astra-orb-shimmer" />
      </div>
      <span className={`astra-orb-state astra-orb-state-${state}`} aria-hidden="true">
        <i />
        {stateLabels[state] || stateLabels.idle}
      </span>
    </div>
  );
}
