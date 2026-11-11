import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAssistant } from "../context/useAssistant";
import AssistantOrb from "./AssistantOrb";
import LiveVoiceConversation from "./LiveVoiceConversation";
import VoiceInput from "./VoiceInput";

const suggestedQuestions = [
  "How is my health today?",
  "Compare my heart rate with yesterday.",
  "How has my sleep changed this week?",
  "I am feeling tired and dizzy. What should I do?",
];

function ResponseSpeechControls({ text }) {
  const { speech } = useAssistant();
  if (!speech.supported) return null;

  const isCurrent = speech.activeText === text;
  const active = isCurrent && (speech.status === "speaking" || speech.status === "paused");
  return (
    <div className="assistant-speech-controls" aria-label="Response audio controls">
      {!active && (
        <button type="button" onClick={() => speech.speak(text)} aria-label="Play response aloud">
        Play aloud
        </button>
      )}
      {speech.canPause && isCurrent && speech.status === "speaking" && <button type="button" onClick={speech.pause}>Pause</button>}
      {speech.canPause && isCurrent && speech.status === "paused" && <button type="button" onClick={speech.resume}>Resume</button>}
      {active && <button type="button" onClick={speech.stop}>Stop</button>}
    </div>
  );
}

export default function AssistantChat({ compact = false }) {
  const {
    messages,
    pending,
    error,
    sendMessage,
    retryLastMessage,
    editLastMessage,
    appendLiveMessage,
    clearConversation,
    speech,
  } = useAssistant();
  const [draft, setDraft] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceError, setVoiceError] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [liveVoiceStatus, setLiveVoiceStatus] = useState("idle");
  const [liveLanguage, setLiveLanguage] = useState("auto");
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const handleVoiceStatus = useCallback((status) => setVoiceStatus(status), []);
  const handleVoiceError = useCallback((hasError) => setVoiceError(hasError), []);
  const handleLiveVoiceStatus = useCallback((status) => setLiveVoiceStatus(status), []);
  const closeLiveVoice = useCallback(() => {
    setLiveVoiceOpen(false);
    setLiveVoiceStatus("idle");
  }, []);
  const handleClearConversation = useCallback(() => {
    clearConversation();
  }, [clearConversation]);
  const submitMessage = useCallback(async (content) => {
    const text = content.trim();
    if (!text || pending || error) return;
    setDraft("");
    setVoiceOpen(false);
    closeLiveVoice();
    await sendMessage(text);
  }, [closeLiveVoice, error, pending, sendMessage]);

  const handleSubmit = (event) => {
    event.preventDefault();
    submitMessage(draft);
  };

  const handleEditLastMessage = () => {
    const text = editLastMessage();
    if (text) setDraft(text);
  };

  const orbState = error || voiceError || speech.status === "error" || liveVoiceStatus === "error"
    ? "error"
    : voiceStatus === "listening" || voiceStatus === "requesting" || liveVoiceStatus === "listening"
      ? "listening"
      : pending || liveVoiceStatus === "connecting" || liveVoiceStatus === "processing"
        ? "processing"
        : liveVoiceStatus === "speaking" || speech.status === "speaking" || speech.status === "paused"
          ? "speaking"
          : "idle";

  return (
    <section className={`assistant-chat-shell${compact ? " assistant-chat-shell-compact" : ""}`} aria-label="ASTRA AI conversation">
      <header className="assistant-chat-toolbar">
        <div className="assistant-chat-identity">
          <span className="assistant-chat-mark" aria-hidden="true">A</span>
          <span><strong>ASTRA AI</strong><small>Mission health companion</small></span>
        </div>
        <div className="assistant-chat-toolbar-actions">
          {speech.supported && speech.voices.length > 0 && (
            <label className="assistant-voice-select">
              <span>Voice</span>
              <select value={speech.selectedVoiceURI} onChange={(event) => speech.setSelectedVoiceURI(event.target.value)} aria-label="Assistant voice">
                {speech.voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="assistant-clear-button"
            onClick={handleClearConversation}
            disabled={!messages.length && !error && !pending}
          >
            Clear chat
          </button>
        </div>
      </header>

      <div className={`assistant-chat-scroll${compact ? " assistant-chat-scroll-compact" : ""}`}>
        <AssistantOrb state={orbState} compact={compact} />

        {!messages.length && (
          <div className="assistant-welcome">
            <h2>How can I support you?</h2>
            <p>Ask a health question or use the microphone to speak. You can review your transcript before sending.</p>
            <div className="assistant-suggestions" aria-label="Suggested questions">
              {suggestedQuestions.map((question) => (
                <button key={question} type="button" onClick={() => submitMessage(question)} disabled={pending || Boolean(error)}>
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="assistant-message-list" aria-live="polite" aria-relevant="additions text">
          {messages.map((message, index) => (
            <article
              className={`assistant-message assistant-message-${message.role}`}
              key={`${message.role}-${index}`}
            >
              <span className="assistant-message-label">{message.role === "user" ? "You" : "ASTRA AI"}</span>
              <p>{message.content}</p>
              {message.role === "assistant" && <ResponseSpeechControls text={message.content} />}
            </article>
          ))}
          {pending && (
            <div className="assistant-processing" role="status">
              <span className="assistant-processing-dots" aria-hidden="true"><i /><i /><i /></span>
              Reviewing the available health context…
            </div>
          )}
          {error && (
            <div className="assistant-error-message" role="alert">
              <p>{error}</p>
              <div>
                <button type="button" onClick={retryLastMessage}>Retry</button>
                <button type="button" onClick={handleEditLastMessage}>Edit question</button>
                <button type="button" onClick={handleClearConversation}>Clear chat</button>
              </div>
            </div>
          )}
          <div ref={messageEndRef} />
        </div>
      </div>

      <div className="assistant-composer">
        {liveVoiceOpen && (
          <LiveVoiceConversation
            messages={messages}
            onConversationMessage={appendLiveMessage}
            onStateChange={handleLiveVoiceStatus}
            onClose={closeLiveVoice}
            language={liveLanguage}
            onLanguageChange={setLiveLanguage}
          />
        )}
        {voiceOpen && (
          <VoiceInput
            onSubmit={submitMessage}
            onStatusChange={handleVoiceStatus}
            onErrorChange={handleVoiceError}
            transcriptLabel="Message to ASTRA AI"
            submitLabel="Send voice message"
            privacyNote="Speech starts only after you press Start listening. Your transcript is sent to ASTRA and Google Gemini only when you submit it."
          />
        )}
        <form className="assistant-compose-form" onSubmit={handleSubmit}>
          <label className="ai-chat-sr-only" htmlFor={compact ? "assistant-dock-input" : "assistant-page-input"}>
            Message ASTRA AI
          </label>
          <textarea
            id={compact ? "assistant-dock-input" : "assistant-page-input"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form.requestSubmit();
              }
            }}
            placeholder="Ask a follow-up or share a symptom…"
            rows={2}
            maxLength={2_000}
            disabled={pending || Boolean(error)}
          />
          <div className="assistant-compose-actions">
            <button
              type="button"
              className="assistant-live-toggle"
              aria-expanded={liveVoiceOpen}
              onClick={() => {
                setVoiceOpen(false);
                speech.stop();
                if (liveVoiceOpen) closeLiveVoice();
                else setLiveVoiceOpen(true);
              }}
              disabled={pending || Boolean(error)}
            >
              {liveVoiceOpen ? "Close live voice" : "Live voice"}
            </button>
            <button
              type="button"
              className="assistant-microphone-toggle"
              aria-expanded={voiceOpen}
              onClick={() => setVoiceOpen((open) => !open)}
              disabled={pending || Boolean(error)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="8" y="3" width="8" height="13" rx="4" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
              </svg>
              {voiceOpen ? "Close mic" : "Microphone"}
            </button>
            <span className="assistant-compose-hint">Enter to send · Shift+Enter for a new line</span>
            <button type="submit" className="assistant-send-button" disabled={!draft.trim() || pending || Boolean(error)}>
              {pending ? "Thinking…" : "Send"}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
            </button>
          </div>
        </form>
        {!speech.supported && (
          <p className="assistant-speech-unavailable">Spoken replies are not available in this browser. You can still chat by text.</p>
        )}
        {!compact && (
          <p className="assistant-chat-disclaimer">
            General information only, not a diagnosis. Data is simulated or crew-reported; messages are sent to Gemini. For urgent symptoms, follow mission medical protocols.
          </p>
        )}
        {compact && (
          <Link className="assistant-open-full-link" to="/ai-assistant">
            Open full conversation <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>
    </section>
  );
}
