import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import VoiceInput from "./VoiceInput";
import { createHealthRecord, extractHealthData, getCrew } from "../services/api";

const valueLabel = (value) => (typeof value === "number" ? String(value) : value);
const recordableParameters = [
  { parameter: "Heart Rate", unit: "BPM" },
  { parameter: "Blood Pressure", unit: "mmHg" },
  { parameter: "Oxygen Saturation", unit: "%" },
  { parameter: "Body Temperature", unit: "°C" },
  { parameter: "Respiratory Rate", unit: "breaths/min" },
  { parameter: "Sleep Duration", unit: "hours" },
  { parameter: "Stress Indicator", unit: "%" },
  { parameter: "Physical Activity", unit: "%" },
];

function HealthRecordReview({ draft, crew, selectedAstronaut, onSelectAstronaut, onChange, onConfirm, onCancel, saving }) {
  const [parameterToAdd, setParameterToAdd] = useState("");
  const updateMeasurement = (index, key, value) => {
    onChange({
      ...draft,
      measurements: draft.measurements.map((measurement, measurementIndex) =>
        measurementIndex === index ? { ...measurement, [key]: value } : measurement
      ),
    });
  };

  const removeMeasurement = (index) => onChange({
    ...draft,
    measurements: draft.measurements.filter((_, measurementIndex) => measurementIndex !== index),
  });

  const updateSymptoms = (value) => onChange({
    ...draft,
    symptoms: value.split(",").map((symptom) => symptom.trim()).filter(Boolean),
  });
  const availableParameters = recordableParameters.filter((entry) =>
    !draft.measurements.some((measurement) => measurement.parameter === entry.parameter)
  );
  const addMeasurement = () => {
    const metric = availableParameters.find((entry) => entry.parameter === parameterToAdd);
    if (!metric) return;
    onChange({
      ...draft,
      measurements: [...draft.measurements, { ...metric, value: "" }],
    });
    setParameterToAdd("");
  };
  const hasInvalidMeasurement = draft.measurements.some((measurement) =>
    measurement.parameter === "Blood Pressure"
      ? !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(String(measurement.value))
      : !/^\d+(?:\.\d+)?$/.test(String(measurement.value))
  );

  return (
    <section className="health-record-review" aria-labelledby="health-record-review-heading">
      <div className="health-record-review-heading">
        <div>
          <span className="app-eyebrow">REVIEW BEFORE SAVING</span>
          <h3 id="health-record-review-heading">Health data detected</h3>
        </div>
        <span className="health-record-review-tag">AI draft · not yet saved</span>
      </div>

      <label className="health-record-field">
        Astronaut
        <select value={selectedAstronaut} onChange={(event) => onSelectAstronaut(event.target.value)} required>
          <option value="">Select the astronaut for this report</option>
          {crew.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}
        </select>
      </label>

      {draft.measurements.map((measurement, index) => (
        <div className="health-record-measurement" key={`${measurement.parameter}-${index}`}>
          <label className="health-record-field">
            {measurement.parameter} ({measurement.unit})
            <input
              inputMode={measurement.parameter === "Blood Pressure" ? "text" : "decimal"}
              value={valueLabel(measurement.value)}
              onChange={(event) => updateMeasurement(index, "value", event.target.value)}
              aria-label={`${measurement.parameter} value`}
            />
          </label>
          <span className="health-record-unit">{measurement.unit}</span>
          <button type="button" className="health-record-remove" onClick={() => removeMeasurement(index)}>
            Remove
          </button>
        </div>
      ))}

      {availableParameters.length > 0 && (
        <div className="health-record-add-measurement">
          <label className="health-record-field" htmlFor="health-record-add-parameter">
            Add a supported measurement
            <select id="health-record-add-parameter" value={parameterToAdd} onChange={(event) => setParameterToAdd(event.target.value)}>
              <option value="">Select a parameter</option>
              {availableParameters.map((metric) => (
                <option key={metric.parameter} value={metric.parameter}>{metric.parameter} ({metric.unit})</option>
              ))}
            </select>
          </label>
          <button type="button" className="health-record-remove" disabled={!parameterToAdd} onClick={addMeasurement}>
            Add measurement
          </button>
        </div>
      )}

      <label className="health-record-field">
        Reported symptoms (separate with commas)
        <textarea
          value={draft.symptoms.join(", ")}
          onChange={(event) => updateSymptoms(event.target.value)}
          rows={2}
        />
      </label>

      {draft.symptoms.length > 0 && (
        <p className="health-record-safety-note" role="note">
          If symptoms include chest pain, severe difficulty breathing, fainting, sudden weakness or confusion, or are rapidly worsening, follow mission medical protocols and contact the mission medical officer immediately.
        </p>
      )}

      {draft.unsupportedParameters.length > 0 && (
        <div className="health-record-unsupported" role="note">
          <strong>Not recordable in the current ASTRA health model</strong>
          {draft.unsupportedParameters.map((entry, index) => (
            <p key={`${entry.name}-${index}`}>
              {entry.name}{entry.value ? `: ${entry.value}` : ""}{entry.unit ? ` ${entry.unit}` : ""}
              {" "}— this information will not be saved.
            </p>
          ))}
        </div>
      )}

      {!draft.measurements.length && !draft.symptoms.length && (
        <p className="health-record-inline-error" role="status">No supported measurements or symptoms remain to save.</p>
      )}
      {hasInvalidMeasurement && (
        <p className="health-record-inline-error" role="alert">
          Complete every value using the displayed unit. Blood pressure must use systolic/diastolic format.
        </p>
      )}
      <p className="health-record-storage-note">
        Review every value. Confirming adds a timestamped crew-reported entry; it does not change treatment.
        This project has no database, so records are held in backend memory and are cleared when the backend restarts.
      </p>
      <div className="health-record-review-actions">
        <button
          type="button"
          className="health-record-confirm"
          disabled={saving || !selectedAstronaut || hasInvalidMeasurement || (!draft.measurements.length && !draft.symptoms.length)}
          onClick={onConfirm}
        >
          {saving ? "Saving…" : "Confirm & Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </section>
  );
}

export default function HealthRecordCapture({ onSaved }) {
  const [crew, setCrew] = useState([]);
  const [crewError, setCrewError] = useState("");
  const [draft, setDraft] = useState(null);
  const [selectedAstronaut, setSelectedAstronaut] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const requestIdRef = useRef("");
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    getCrew({ signal: controller.signal })
      .then((members) => {
        if (mountedRef.current) setCrew(members);
      })
      .catch((requestError) => {
        if (mountedRef.current && requestError.name !== "AbortError") setCrewError(requestError.message);
      });
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, []);

  const captureTranscript = async (text) => {
    setExtracting(true);
    setError("");
    setSuccess(null);
    setDraft(null);
    requestIdRef.current = "";
    try {
      const response = await extractHealthData(text);
      if (!mountedRef.current) return;
      setDraft(response.healthDraft);
      requestIdRef.current = globalThis.crypto?.randomUUID?.()
        || `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setSelectedAstronaut("");
    } catch (requestError) {
      if (mountedRef.current) setError(requestError.message || "Health data could not be extracted.");
    } finally {
      if (mountedRef.current) setExtracting(false);
    }
  };

  const confirmRecord = async () => {
    if (!draft || !selectedAstronaut || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createHealthRecord({
        astronautId: selectedAstronaut,
        requestId: requestIdRef.current,
        measurements: draft.measurements,
        symptoms: draft.symptoms,
      });
      if (!mountedRef.current) return;
      setSuccess(result);
      setDraft(null);
      onSaved?.();
    } catch (requestError) {
      if (mountedRef.current) setError(requestError.message || "The health record could not be saved.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const cancelDraft = () => {
    setDraft(null);
    setError("");
    setSelectedAstronaut("");
    requestIdRef.current = "";
  };

  return (
    <div className="health-record-capture">
      {crewError && <p className="health-record-inline-error" role="alert">Crew list unavailable: {crewError}</p>}
      <VoiceInput
        onSubmit={captureTranscript}
        submitLabel={extracting ? "Extracting…" : "Review health data"}
        privacyNote="Submitting sends your transcript to the ASTRA backend and Google Gemini for extraction. No health record is saved until you confirm it below."
      />
      {extracting && <p className="health-record-processing" role="status">Extracting explicitly reported values. No record is being saved.</p>}
      {error && <p className="health-record-inline-error" role="alert">{error}</p>}
      {draft && (
        <HealthRecordReview
          draft={draft}
          crew={crew}
          selectedAstronaut={selectedAstronaut}
          onSelectAstronaut={setSelectedAstronaut}
          onChange={setDraft}
          onConfirm={confirmRecord}
          onCancel={cancelDraft}
          saving={saving}
        />
      )}
      {success && (
        <section className="health-record-saved" role="status" aria-live="polite">
          <strong>{success.created ? "Health record confirmed" : "This report was already saved"}</strong>
          <p>
            {success.record.astronautName} · {new Date(success.record.timestamp).toLocaleString()}
            {" · "}{success.record.measurements.length} measurement(s), {success.record.symptoms.length} reported symptom(s)
          </p>
          <p>Assessment uses existing rule-based demonstration bands only; it is not a diagnosis.</p>
          {success.alerts.length > 0 && (
            <p>{success.alerts.length} related alert(s) are available in <Link to="/risk-alerts">Risk Alerts</Link>.</p>
          )}
          {success.riskOutlook && <p>Current rule-based outlook: {success.riskOutlook.label}.</p>}
          <Link to="/health-history">View confirmed records in Health History</Link>
        </section>
      )}
    </div>
  );
}
