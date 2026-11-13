import { useEffect, useRef, useState } from "react";

const ERROR_MESSAGES = {
  "not-allowed": "Microphone permission was denied. Allow microphone access in your browser settings and try again.",
  "service-not-allowed": "The browser speech-recognition service is not allowed. Check browser permissions and try again.",
  "audio-capture": "No microphone is available. Connect or enable a microphone, or type your health note instead.",
  network: "Speech recognition could not reach its service. Check your connection or type your health note instead.",
  "no-speech": "No speech was detected. Try again or type your health note instead.",
  "language-not-supported": "Speech recognition does not support this language in your browser.",
  aborted: "Speech recognition was stopped.",
};

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function VoiceInput({
  onSubmit,
  transcriptLabel = "Health note",
  submitLabel = "Submit draft",
  onStatusChange,
  onErrorChange,
  privacyNote = "Speech recognition may use your browser’s speech service. Transcripts are kept on this page and are not saved to the ASTRA API.",
}) {
  const recognitionRef = useRef(null);
  const mountedRef = useRef(false);
  const cancelledRef = useRef(false);
  const captureIdRef = useRef(0);
  const settleTimerRef = useRef(null);
  const [supported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const [status, setStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      captureIdRef.current += 1;
      window.clearTimeout(settleTimerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    onErrorChange?.(Boolean(error));
  }, [error, onErrorChange]);

  const startListening = async () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. You can still type in the text area.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is unavailable in this browser. You can still type in the text area.");
      return;
    }

    setError("");
    setStatus("requesting");
    cancelledRef.current = false;
    const captureId = captureIdRef.current + 1;
    captureIdRef.current = captureId;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (permissionError) {
      if (!mountedRef.current || captureIdRef.current !== captureId) return;
      const message = permissionError?.name === "NotAllowedError" || permissionError?.name === "PermissionDeniedError"
        ? ERROR_MESSAGES["not-allowed"]
        : permissionError?.name === "NotFoundError" || permissionError?.name === "DevicesNotFoundError"
          ? ERROR_MESSAGES["audio-capture"]
          : `Microphone access failed: ${permissionError?.message || "unknown error"}. You can still type your health note.`;
      setError(message);
      setStatus("idle");
      return;
    }
    stream.getTracks().forEach((track) => track.stop());

    if (!mountedRef.current || captureIdRef.current !== captureId) return;

    let recognition;
    try {
      recognition = new SpeechRecognition();
    } catch (recognitionError) {
      setStatus("idle");
      setError(`Speech recognition could not be initialized: ${recognitionError.message || "unknown error"}. You can type your health note instead.`);
      return;
    }

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      if (mountedRef.current) setStatus("listening");
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const spokenText = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .filter(Boolean)
        .join(" ");
      if (mountedRef.current) setTranscript(spokenText);
    };
    recognition.onerror = (event) => {
      if (
        captureIdRef.current !== captureId
        ||
        recognitionRef.current !== recognition
        || !mountedRef.current
        || (cancelledRef.current && event.error === "aborted")
      ) return;
      setError(ERROR_MESSAGES[event.error] || `Speech recognition failed (${event.error || "unknown error"}). You can type your health note instead.`);
      setStatus("idle");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!mountedRef.current) return;
      if (cancelledRef.current) {
        setStatus("idle");
        return;
      }
      setStatus("processing");
      settleTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setStatus("idle");
      }, 250);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (recognitionError) {
      recognitionRef.current = null;
      setStatus("idle");
      setError(`Speech recognition could not start: ${recognitionError.message || "unknown error"}. You can type your health note instead.`);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    cancelledRef.current = false;
    setStatus("processing");
    recognitionRef.current.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    captureIdRef.current += 1;
    window.clearTimeout(settleTimerRef.current);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setTranscript("");
    setError("");
    setStatus("idle");
  };

  const clearTranscript = () => {
    setTranscript("");
    setError("");
  };

  const submitTranscript = (event) => {
    event.preventDefault();
    const value = transcript.trim();
    if (!value || status !== "idle") return;
    onSubmit(value);
  };

  const statusLabel = {
    idle: supported ? "Idle · ready to listen" : "Voice recognition unavailable",
    requesting: "Requesting microphone access…",
    listening: "Listening",
    processing: "Processing speech…",
  }[status];

  return (
    <form className="voice-input-panel" onSubmit={submitTranscript}>
      <div className="voice-input-status-row">
        <span className={`voice-input-status voice-input-status-${status}`} role="status" aria-live="polite">
          <span aria-hidden="true" />
          {statusLabel}
        </span>
        {!supported && <span className="voice-input-support-note">This browser does not support speech recognition. Typing is available.</span>}
      </div>

      <label className="voice-input-label" htmlFor="health-voice-transcript">
        {transcriptLabel}
      </label>
      <textarea
        id="health-voice-transcript"
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="Speak or type a health note, e.g. “My heart rate is 85 BPM.”"
        rows={4}
      />

      {(error || !supported) && (
        <p className="voice-input-error" role="alert">
          {error || "Speech recognition is not supported in this browser. You can still type and submit a health note."}
        </p>
      )}

      <div className="voice-input-actions">
        <button
          className={`voice-input-microphone${status === "listening" ? " is-listening" : ""}`}
          type="button"
          onClick={status === "listening" ? stopListening : startListening}
          disabled={status === "requesting" || status === "processing" || (!supported && status !== "listening")}
          aria-pressed={status === "listening"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {status === "listening"
              ? <rect x="7" y="7" width="10" height="10" rx="1" />
              : <><rect x="8" y="3" width="8" height="13" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></>}
          </svg>
          {status === "listening" ? "Stop listening" : "Start listening"}
        </button>
        <div className="voice-input-secondary-actions">
          <button type="button" onClick={clearTranscript} disabled={!transcript && !error}>
            Clear
          </button>
          <button type="button" onClick={cancel} disabled={status === "idle" && !transcript && !error}>
            Cancel
          </button>
          <button className="voice-input-submit" type="submit" disabled={!transcript.trim() || status !== "idle"}>
            {submitLabel}
          </button>
        </div>
      </div>

      <p className="voice-input-privacy-note">
        {privacyNote}
      </p>
    </form>
  );
}
